import { Type } from 'class-transformer';
import { IsArray, IsMongoId, ValidateNested } from 'class-validator';

class AnswerInputDto {
  @IsMongoId()
  questionId: string;

  @IsArray()
  selectedOptionIndexes: number[];
}

export class SubmitAttemptDto {
  @ValidateNested({ each: true })
  @Type(() => AnswerInputDto)
  @IsArray()
  answers: AnswerInputDto[];
}
