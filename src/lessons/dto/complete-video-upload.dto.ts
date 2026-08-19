import { IsOptional, IsString } from 'class-validator';

export class CompleteVideoUploadDto {
  @IsString()
  videoId: string;

  @IsString()
  playbackUrl: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;
}
