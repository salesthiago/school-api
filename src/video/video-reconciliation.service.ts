import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Lesson, LessonDocument } from '../lessons/schemas/lesson.schema';
import { BunnyStreamService } from './bunny-stream.service';
import { VideoStatusService } from './video-status.service';

/**
 * Rede de segurança para o webhook do Bunny: a cada minuto, verifica direto na API
 * do Bunny o status de qualquer vídeo ainda marcado como "processing" no banco.
 * Cobre os casos em que o webhook nunca chega (config errada no painel do Bunny,
 * webhook desabilitado, payload rejeitado por validação, instabilidade de rede etc.).
 */
@Injectable()
export class VideoReconciliationService {
  private readonly logger = new Logger(VideoReconciliationService.name);
  private running = false;

  constructor(
    @InjectModel(Lesson.name) private lessonModel: Model<LessonDocument>,
    private bunnyStreamService: BunnyStreamService,
    private videoStatusService: VideoStatusService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcileProcessingVideos() {
    if (this.running) return;
    this.running = true;
    try {
      const stuck = await this.lessonModel.find({ 'video.status': 'processing' });
      if (!stuck.length) return;

      this.logger.debug(`Reconciliação: ${stuck.length} vídeo(s) em processamento para verificar`);

      for (const lesson of stuck) {
        try {
          const bunnyStatus = await this.bunnyStreamService.getVideoStatus(lesson.video!.externalId);
          if (bunnyStatus === null) continue;

          const changed = await this.videoStatusService.applyBunnyStatus(lesson, bunnyStatus);
          if (changed) {
            this.logger.log(
              `Vídeo da lesson ${lesson.id} atualizado via reconciliação (status Bunny=${bunnyStatus})`,
            );
          }
        } catch (err) {
          this.logger.error(`Falha ao reconciliar vídeo da lesson ${lesson.id}: ${(err as Error).message}`);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
