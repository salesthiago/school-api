import { IsBoolean, IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { ExamScope } from '../schemas/exam.schema';

export class CreateExamDto {
  @IsString()
  @MinLength(3)
  title: string;

  @IsEnum(ExamScope)
  scope: ExamScope;

  /** Obrigatório quando scope = LESSON. */
  @IsOptional()
  @IsMongoId()
  lessonId?: string;

  /** Obrigatório quando scope = MODULE. */
  @IsOptional()
  @IsMongoId()
  moduleId?: string;

  /** Obrigatório quando scope = COURSE (nos outros scopes é resolvido no service). */
  @IsOptional()
  @IsMongoId()
  courseId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  minScorePercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxAttempts?: number;

  @IsOptional()
  @IsBoolean()
  allowRetake?: boolean;

  @IsOptional()
  @IsBoolean()
  showCorrectAnswers?: boolean;

  @IsOptional()
  @IsBoolean()
  immediateResult?: boolean;
}
