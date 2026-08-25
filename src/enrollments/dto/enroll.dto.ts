import { IsMongoId, IsOptional } from 'class-validator';

export class EnrollDto {
  /** Obrigatório só quando moduleId está ausente (matrícula direto na trilha avulsa do curso). */
  @IsOptional()
  @IsMongoId()
  courseId?: string;

  /** Ausente = matrícula na trilha de aulas avulsas do curso, não num módulo específico. */
  @IsOptional()
  @IsMongoId()
  moduleId?: string;
}
