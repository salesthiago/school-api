import { IsMongoId } from 'class-validator';

export class ManualEnrollDto {
  @IsMongoId()
  studentId: string;

  @IsMongoId()
  moduleId: string;
}
