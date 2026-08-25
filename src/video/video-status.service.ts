import { Injectable } from '@nestjs/common';
import { LessonDocument } from '../lessons/schemas/lesson.schema';
import { NotificationsService } from '../notifications/notifications.service';

export const READY_STATUSES = [4]; // Finished
export const ERROR_STATUSES = [5, 6]; // Error, UploadFailed

/**
 * Aplica um status vindo do Bunny (webhook ou polling de reconciliação) a uma lesson,
 * mantendo os dois caminhos consistentes em vez de duplicar a lógica de transição.
 */
@Injectable()
export class VideoStatusService {
  constructor(private notificationsService: NotificationsService) {}

  async applyBunnyStatus(lesson: LessonDocument, bunnyStatus: number): Promise<boolean> {
    if (!lesson.video || lesson.video.status !== 'processing') return false;

    if (READY_STATUSES.includes(bunnyStatus)) {
      lesson.video.status = 'ready';
      await lesson.save();
      await this.notificationsService.create(
        lesson.teacherId.toString(),
        'Vídeo pronto',
        `O vídeo da aula "${lesson.title}" terminou de processar e já está disponível para os alunos.`,
      );
      return true;
    }

    if (ERROR_STATUSES.includes(bunnyStatus)) {
      lesson.video.status = 'error';
      await lesson.save();
      await this.notificationsService.create(
        lesson.teacherId.toString(),
        'Falha ao processar vídeo',
        `Houve um erro ao processar o vídeo da aula "${lesson.title}". Tente enviar novamente.`,
      );
      return true;
    }

    return false;
  }
}
