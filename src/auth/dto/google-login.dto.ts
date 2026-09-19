import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleLoginDto {
  /** ID token (JWT) devolvido pelo Login com Google no app. */
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
