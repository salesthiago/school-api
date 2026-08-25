import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { SettingsService } from '../settings/settings.service';

export interface UploadedVideo {
  externalId: string;
  playbackUrl: string;
  thumbnailUrl?: string;
}

export interface DirectUploadCredentials {
  tusEndpoint: string;
  videoId: string;
  libraryId: string;
  authorizationSignature: string;
  authorizationExpire: number;
  playbackUrl: string;
  thumbnailUrl?: string;
}

const BUNNY_STREAM_API = 'https://video.bunnycdn.com';
const BUNNY_TUS_ENDPOINT = 'https://video.bunnycdn.com/tusupload';
const DIRECT_UPLOAD_TTL_SECONDS = 60 * 60 * 3; // 3h para dar tempo de enviar vídeos grandes

/**
 * Integração com a API de vídeo do Bunny.net (Bunny Stream).
 * Credenciais vêm do SettingsService (gerenciadas pelo admin), não de env vars,
 * para que a tela de configuração possa alterá-las em tempo real.
 *
 * O upload do arquivo em si NUNCA passa pelo nosso backend — o vídeo vai
 * direto do navegador do professor para o Bunny.net via TUS (protocolo de
 * upload resumível), usando uma assinatura de curta duração gerada aqui.
 * Isso evita estourar o limite de tamanho do nginx/memória da instância e
 * elimina o "CORS" que na real era o proxy rejeitando o corpo da requisição
 * antes de chegar no Node.
 */
@Injectable()
export class BunnyStreamService {
  constructor(private readonly settingsService: SettingsService) {}

  async createDirectUpload(title: string): Promise<DirectUploadCredentials> {
    const config = await this.settingsService.getBunnyProviderConfig();
    if (!config) {
      throw new BadRequestException('Integração com o Bunny.net não está configurada ou está desativada');
    }

    const createResponse = await fetch(`${BUNNY_STREAM_API}/library/${config.libraryId}/videos`, {
      method: 'POST',
      headers: { AccessKey: config.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (!createResponse.ok) {
      throw new BadGatewayException('Falha ao criar o vídeo no Bunny.net');
    }
    const created = (await createResponse.json()) as { guid: string };

    const authorizationExpire = Math.floor(Date.now() / 1000) + DIRECT_UPLOAD_TTL_SECONDS;
    const authorizationSignature = createHash('sha256')
      .update(`${config.libraryId}${config.apiKey}${authorizationExpire}${created.guid}`)
      .digest('hex');

    return {
      tusEndpoint: BUNNY_TUS_ENDPOINT,
      videoId: created.guid,
      libraryId: config.libraryId,
      authorizationSignature,
      authorizationExpire,
      playbackUrl: `https://iframe.mediadelivery.net/embed/${config.libraryId}/${created.guid}`,
      thumbnailUrl: config.pullZoneHostname
        ? `https://${config.pullZoneHostname}/${created.guid}/thumbnail.jpg`
        : undefined,
    };
  }

  async deleteVideo(externalId: string): Promise<void> {
    const config = await this.settingsService.getBunnyProviderConfig();
    if (!config) return;
    await fetch(`${BUNNY_STREAM_API}/library/${config.libraryId}/videos/${externalId}`, {
      method: 'DELETE',
      headers: { AccessKey: config.apiKey },
    });
  }

  /**
   * Consulta o status atual de processamento direto na API do Bunny (mesmos códigos
   * do webhook: 0 Created, 1 Uploaded, 2 Processing, 3 Transcoding, 4 Finished,
   * 5 Error, 6 UploadFailed). Usado pelo job de reconciliação como rede de segurança
   * para quando o webhook falha ou nunca chega.
   */
  async getVideoStatus(externalId: string): Promise<number | null> {
    const config = await this.settingsService.getBunnyProviderConfig();
    if (!config) return null;

    const response = await fetch(`${BUNNY_STREAM_API}/library/${config.libraryId}/videos/${externalId}`, {
      headers: { AccessKey: config.apiKey },
    });
    if (!response.ok) return null;

    const data = (await response.json()) as { status: number };
    return data.status;
  }
}
