import { IsMongoId, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateProgressDto {
  @IsMongoId()
  lessonId: string;

  /** Ausente quando a aula é avulsa (sem módulo). */
  @IsOptional()
  @IsMongoId()
  moduleId?: string;

  @IsNumber()
  @Min(0)
  watchedSeconds: number;
}
