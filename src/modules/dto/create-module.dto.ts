import { IsBoolean, IsMongoId, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateModuleDto {
  @IsMongoId()
  courseId: string;

  @IsString()
  @MinLength(3)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsBoolean()
  free?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  workloadHours?: number;
}
