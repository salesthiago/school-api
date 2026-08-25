import { IsMongoId, IsOptional } from 'class-validator';

export class ManualEnrollDto {
  @IsMongoId()
  studentId: string;

  /** Obrigatório só quando moduleId está ausente (matrícula direto na trilha avulsa do curso). */
  @IsOptional()
  @IsMongoId()
  courseId?: string;

  @IsOptional()
  @IsMongoId()
  moduleId?: string;
}
