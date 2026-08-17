import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateBunnySettingsDto {
  @IsOptional()
  @IsString()
  libraryId?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  apiKey?: string;

  @IsOptional()
  @IsString()
  pullZoneHostname?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
