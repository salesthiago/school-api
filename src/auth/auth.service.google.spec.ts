import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Role } from '../common/enums/role.enum';

type Mocked<T> = { [K in keyof T]: jest.Mock };

function buildService(identity: Partial<Record<string, unknown>> = {}) {
  const usersService = {
    findByGoogleId: jest.fn(),
    findByEmail: jest.fn(),
    createFromGoogle: jest.fn(),
    linkGoogleId: jest.fn(),
    setRefreshTokenHash: jest.fn(),
  } as unknown as Mocked<Record<string, never>>;
  const jwtService = { sign: jest.fn().mockReturnValue('token') };
  const config = { get: jest.fn() };
  const verifier = {
    verify: jest.fn().mockResolvedValue({
      sub: 'google-sub-1',
      email: 'aluno@gmail.com',
      emailVerified: true,
      name: 'Aluno Teste',
      ...identity,
    }),
  };
  const service = new AuthService(
    usersService as never,
    jwtService as never,
    config as never,
    verifier as never,
  );
  return {
    service,
    usersService: usersService as never as Record<string, jest.Mock>,
    verifier,
  };
}

const existingUser = (extra: Record<string, unknown> = {}) => ({
  id: 'u1',
  email: 'aluno@gmail.com',
  role: Role.STUDENT,
  active: true,
  googleId: undefined,
  institutionId: undefined,
  ...extra,
});

describe('AuthService.googleLogin', () => {
  it('cria uma conta de aluno quando não existe conta com o e-mail', async () => {
    const { service, usersService } = buildService();
    usersService.findByGoogleId.mockResolvedValue(null);
    usersService.findByEmail.mockResolvedValue(null);
    usersService.createFromGoogle.mockResolvedValue(
      existingUser({ id: 'novo' }),
    );

    const tokens = await service.googleLogin('id-token');

    expect(usersService.createFromGoogle).toHaveBeenCalledWith({
      name: 'Aluno Teste',
      email: 'aluno@gmail.com',
      googleId: 'google-sub-1',
    });
    expect(usersService.linkGoogleId).not.toHaveBeenCalled();
    expect(tokens).toEqual({ accessToken: 'token', refreshToken: 'token' });
  });

  it('vincula o Google à conta existente com o mesmo e-mail (sem criar outra)', async () => {
    const { service, usersService } = buildService();
    const user = existingUser();
    usersService.findByGoogleId.mockResolvedValue(null);
    usersService.findByEmail.mockResolvedValue(user);
    usersService.linkGoogleId.mockResolvedValue({
      ...user,
      googleId: 'google-sub-1',
    });

    await service.googleLogin('id-token');

    expect(usersService.linkGoogleId).toHaveBeenCalledWith(
      user,
      'google-sub-1',
    );
    expect(usersService.createFromGoogle).not.toHaveBeenCalled();
  });

  it('entra direto quando o Google já está vinculado a uma conta', async () => {
    const { service, usersService } = buildService();
    usersService.findByGoogleId.mockResolvedValue(
      existingUser({ googleId: 'google-sub-1' }),
    );

    await service.googleLogin('id-token');

    expect(usersService.findByEmail).not.toHaveBeenCalled();
    expect(usersService.linkGoogleId).not.toHaveBeenCalled();
    expect(usersService.createFromGoogle).not.toHaveBeenCalled();
  });

  it('recusa e-mail não verificado pelo Google (evita tomar conta alheia)', async () => {
    const { service, usersService } = buildService({ emailVerified: false });

    await expect(service.googleLogin('id-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(usersService.findByEmail).not.toHaveBeenCalled();
    expect(usersService.linkGoogleId).not.toHaveBeenCalled();
  });

  it('recusa quando o e-mail já está vinculado a outra conta Google', async () => {
    const { service, usersService } = buildService();
    usersService.findByGoogleId.mockResolvedValue(null);
    usersService.findByEmail.mockResolvedValue(
      existingUser({ googleId: 'outro-google' }),
    );

    await expect(service.googleLogin('id-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(usersService.linkGoogleId).not.toHaveBeenCalled();
  });

  it('recusa usuário inativo, sem vincular', async () => {
    const { service, usersService } = buildService();
    usersService.findByGoogleId.mockResolvedValue(null);
    usersService.findByEmail.mockResolvedValue(existingUser({ active: false }));

    await expect(service.googleLogin('id-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(usersService.linkGoogleId).not.toHaveBeenCalled();
  });
});
