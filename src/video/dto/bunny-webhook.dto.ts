import { IsInt, IsString } from 'class-validator';

/**
 * Payload que o Bunny Stream envia no webhook de status de vídeo
 * (configurado manualmente no painel do Bunny — veja backend/deploy/README.md).
 * Status: 0 Created, 1 Uploaded, 2 Processing, 3 Transcoding, 4 Finished,
 * 5 Error, 6 UploadFailed.
 */
export class BunnyWebhookDto {
  @IsString()
  VideoGuid: string;

  @IsInt()
  Status: number;
}
