import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class VideoMetaDto {
  @IsString()
  provider: string;

  @IsString()
  externalId: string;

  @IsOptional()
  @IsString()
  playbackUrl?: string;

  @IsNumber()
  @Min(0)
  durationSeconds: number;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;
}
