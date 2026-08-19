import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Role } from '../common/enums/role.enum';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.usersService.create(dto, Role.STUDENT);
    return this.issueTokens(user.id, user.email, user.role, user.institutionId?.toString() ?? '');
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.active) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    return this.issueTokens(user.id, user.email, user.role, user.institutionId?.toString() ?? '');
  }

  async refresh(userId: string, refreshToken: string) {
    const user = await this.usersService.findById(userId);
    if (!user.refreshTokenHash) {
      throw new UnauthorizedException('Sessão inválida');
    }
    const matches = await bcrypt.compare(this.digestToken(refreshToken), user.refreshTokenHash);
    if (!matches) {
      throw new UnauthorizedException('Sessão inválida');
    }
    return this.issueTokens(user.id, user.email, user.role, user.institutionId?.toString() ?? '');
  }

  async logout(userId: string) {
    await this.usersService.setRefreshTokenHash(userId, null);
  }

  verifyRefreshToken(token: string) {
    return this.jwtService.verify(token, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET') ?? 'dev-refresh-secret',
    });
  }

  private async issueTokens(
    sub: string,
    email: string,
    role: string,
    institutionId: string,
  ): Promise<TokenPair> {
    const payload = { sub, email, role, institutionId };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET') ?? 'dev-access-secret',
      expiresIn: (this.config.get<string>('JWT_ACCESS_EXPIRES') ?? '15m') as StringValue,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET') ?? 'dev-refresh-secret',
      expiresIn: (this.config.get<string>('JWT_REFRESH_EXPIRES') ?? '7d') as StringValue,
    });

    const refreshTokenHash = await bcrypt.hash(this.digestToken(refreshToken), 10);
    await this.usersService.setRefreshTokenHash(sub, refreshTokenHash);

    return { accessToken, refreshToken };
  }

  /**
   * bcrypt trunca a entrada em 72 bytes. Um JWT de refresh inteiro passa
   * bastante disso, e os primeiros ~72 bytes (header + início do payload)
   * são idênticos entre todos os tokens emitidos para o mesmo usuário (iat/exp
   * ficam no fim do payload) — ou seja, comparar o JWT bruto com bcrypt faz
   * QUALQUER token válido (antigo ou até forjado com o mesmo secret) bater
   * com o hash armazenado, e a rotação de refresh token nunca invalida nada
   * de fato. Resumimos o token para um digest de tamanho fixo antes do bcrypt.
   */
  private digestToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
