import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

export interface UploadedVideo {
  externalId: string;
  playbackUrl: string;
  thumbnailUrl?: string;
}

const BUNNY_STREAM_API = 'https://video.bunnycdn.com';

/**
 * Integração com a API de vídeo do Bunny.net (Bunny Stream).
 * Credenciais vêm do SettingsService (gerenciadas pelo admin), não de env vars,
 * para que a tela de configuração possa alterá-las em tempo real.
 */
@Injectable()
export class BunnyStreamService {
  constructor(private readonly settingsService: SettingsService) {}

  async uploadVideo(title: string, buffer: Buffer): Promise<UploadedVideo> {
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

    const uploadResponse = await fetch(
      `${BUNNY_STREAM_API}/library/${config.libraryId}/videos/${created.guid}`,
      { method: 'PUT', headers: { AccessKey: config.apiKey }, body: new Uint8Array(buffer) },
    );
    if (!uploadResponse.ok) {
      throw new BadGatewayException('Falha ao enviar o arquivo de vídeo para o Bunny.net');
    }

    return {
      externalId: created.guid,
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
}
