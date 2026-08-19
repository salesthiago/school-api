import { IsMongoId } from 'class-validator';

export class EnrollDto {
  @IsMongoId()
  moduleId: string;
}
