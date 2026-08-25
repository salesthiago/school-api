import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  Logger,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Lesson, LessonDocument } from '../lessons/schemas/lesson.schema';
import { BunnyWebhookDto } from './dto/bunny-webhook.dto';
import { VideoStatusService } from './video-status.service';

/**
 * Webhook público chamado pelo Bunny Stream quando o status de
 * processamento de um vídeo muda. Configuração manual no painel do Bunny
 * (Video Library → API → Webhook URL), veja backend/deploy/README.md.
 */
@Controller('video')
export class VideoController {
  private readonly logger = new Logger(VideoController.name);

  constructor(
    @InjectModel(Lesson.name) private lessonModel: Model<LessonDocument>,
    private videoStatusService: VideoStatusService,
    private config: ConfigService,
  ) {}

  @Post('webhook/bunny')
  @HttpCode(200)
  // O payload real do Bunny traz campos além de VideoGuid/Status (ex: VideoLibraryId).
  // O ValidationPipe global usa forbidNonWhitelisted, que rejeitaria (400) esse payload
  // antes de chegar aqui — por isso sobrescrevemos com whitelist only para este endpoint.
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async handleBunnyWebhook(@Body() dto: BunnyWebhookDto, @Query('token') token?: string) {
    const expected = this.config.get<string>('BUNNY_WEBHOOK_SECRET') ?? 'dev-bunny-webhook-secret';
    if (token !== expected) {
      throw new ForbiddenException('Token inválido');
    }

    const lesson = await this.lessonModel.findOne({ 'video.externalId': dto.VideoGuid });
    if (!lesson || !lesson.video) {
      this.logger.warn(`Webhook Bunny: nenhuma lesson encontrada para VideoGuid=${dto.VideoGuid}`);
      return { ok: true };
    }

    await this.videoStatusService.applyBunnyStatus(lesson, dto.Status);

    return { ok: true };
  }
}
