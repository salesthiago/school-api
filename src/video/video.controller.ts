import { Body, Controller, ForbiddenException, HttpCode, Post, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Lesson, LessonDocument } from '../lessons/schemas/lesson.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { BunnyWebhookDto } from './dto/bunny-webhook.dto';

const READY_STATUSES = [4]; // Finished
const ERROR_STATUSES = [5, 6]; // Error, UploadFailed

/**
 * Webhook público chamado pelo Bunny Stream quando o status de
 * processamento de um vídeo muda. Configuração manual no painel do Bunny
 * (Video Library → API → Webhook URL), veja backend/deploy/README.md.
 */
@Controller('video')
export class VideoController {
  constructor(
    @InjectModel(Lesson.name) private lessonModel: Model<LessonDocument>,
    private notificationsService: NotificationsService,
    private config: ConfigService,
  ) {}

  @Post('webhook/bunny')
  @HttpCode(200)
  async handleBunnyWebhook(@Body() dto: BunnyWebhookDto, @Query('token') token?: string) {
    const expected = this.config.get<string>('BUNNY_WEBHOOK_SECRET') ?? 'dev-bunny-webhook-secret';
    if (token !== expected) {
      throw new ForbiddenException('Token inválido');
    }

    const lesson = await this.lessonModel.findOne({ 'video.externalId': dto.VideoGuid });
    if (!lesson || !lesson.video) {
      return { ok: true };
    }

    if (READY_STATUSES.includes(dto.Status)) {
      lesson.video.status = 'ready';
      await lesson.save();
      await this.notificationsService.create(
        lesson.teacherId.toString(),
        'Vídeo pronto',
        `O vídeo da aula "${lesson.title}" terminou de processar e já está disponível para os alunos.`,
      );
    } else if (ERROR_STATUSES.includes(dto.Status)) {
      lesson.video.status = 'error';
      await lesson.save();
      await this.notificationsService.create(
        lesson.teacherId.toString(),
        'Falha ao processar vídeo',
        `Houve um erro ao processar o vídeo da aula "${lesson.title}". Tente enviar novamente.`,
      );
    }

    return { ok: true };
  }
}
