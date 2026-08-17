import { Type } from 'class-transformer';
import { ArrayMinSize, IsBoolean, IsEnum, IsNumber, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { QuestionType } from '../schemas/question.schema';

class QuestionOptionDto {
  @IsString()
  text: string;

  @IsBoolean()
  correct: boolean;
}

export class CreateQuestionDto {
  @IsString()
  @MinLength(3)
  text: string;

  @IsEnum(QuestionType)
  type: QuestionType;

  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  @ArrayMinSize(2)
  options: QuestionOptionDto[];

  @IsOptional()
  @IsNumber()
  order?: number;
}
