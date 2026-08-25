import { IsBoolean, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCourseDto {
  @IsString()
  @MinLength(3)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  sellAsBundle?: boolean;

  /** Preço da trilha de aulas avulsas do curso (aulas sem módulo). */
  @IsOptional()
  @IsNumber()
  bundlePrice?: number;

  /** Trilha de aulas avulsas gratuita — ver bundlePrice. */
  @IsOptional()
  @IsBoolean()
  free?: boolean;
}
