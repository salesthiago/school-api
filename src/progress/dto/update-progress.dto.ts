import { IsMongoId, IsNumber, Min } from 'class-validator';

export class UpdateProgressDto {
  @IsMongoId()
  lessonId: string;

  @IsMongoId()
  moduleId: string;

  @IsNumber()
  @Min(0)
  watchedSeconds: number;
}
