import { Type } from 'class-transformer';
import { IsBoolean, IsMongoId, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';
import { VideoMetaDto } from './video-meta.dto';

export class CreateLessonDto {
  @IsMongoId()
  courseId: string;

  /** Ausente = aula avulsa, direto no curso, sem módulo. */
  @IsOptional()
  @IsMongoId()
  moduleId?: string;

  @IsString()
  @MinLength(3)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => VideoMetaDto)
  video?: VideoMetaDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  mandatory?: boolean;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
