import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleIdentity {
  /** Identificador estável da conta Google (claim `sub`). */
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

/**
 * Valida o ID token que o app obtém do Google (assinatura, expiração e audiência).
 * `GOOGLE_CLIENT_IDS` = IDs de cliente OAuth aceitos como audiência, separados por vírgula
 * (no app Android é o ID do cliente "Web" do projeto).
 */
@Injectable()
export class GoogleTokenVerifier {
  private readonly client = new OAuth2Client();

  constructor(private readonly config: ConfigService) {}

  async verify(idToken: string): Promise<GoogleIdentity> {
    const audience = (this.config.get<string>('GOOGLE_CLIENT_IDS') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (audience.length === 0) {
      throw new ServiceUnavailableException(
        'Login com Google não está configurado',
      );
    }

    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email) {
        throw new Error('Token sem sub/e-mail');
      }
      return {
        sub: payload.sub,
        email: payload.email,
        emailVerified: payload.email_verified === true,
        name: payload.name?.trim() || payload.email.split('@')[0],
      };
    } catch {
      throw new UnauthorizedException('Token do Google inválido');
    }
  }
}
