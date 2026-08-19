import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Lesson, LessonDocument } from './schemas/lesson.schema';
import { CourseModule, CourseModuleDocument } from '../modules/schemas/module.schema';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import { Attachment, AttachmentDocument } from '../attachments/schemas/attachment.schema';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { CompleteVideoUploadDto } from './dto/complete-video-upload.dto';
import { JwtUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { BunnyStreamService } from '../video/bunny-stream.service';
import { STORAGE_PROVIDER, StorageProvider } from '../storage/storage-provider.interface';

@Injectable()
export class LessonsService {
  constructor(
    @InjectModel(Lesson.name) private lessonModel: Model<LessonDocument>,
    @InjectModel(CourseModule.name) private moduleModel: Model<CourseModuleDocument>,
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
    @InjectModel(Attachment.name) private attachmentModel: Model<AttachmentDocument>,
    private readonly bunnyStream: BunnyStreamService,
    @Inject(STORAGE_PROVIDER) private storage: StorageProvider,
  ) {}

  async create(dto: CreateLessonDto, teacher: JwtUser) {
    await this.assertModuleOwnership(dto.moduleId, teacher);
    return this.lessonModel.create({ ...dto, teacherId: teacher.userId });
  }

  findByModule(moduleId: string) {
    return this.lessonModel.find({ moduleId }).sort({ order: 1 });
  }

  countMandatoryByModule(moduleId: string) {
    return this.lessonModel.countDocuments({ moduleId, mandatory: true, published: true });
  }

  async findById(id: string): Promise<LessonDocument> {
    const lesson = await this.lessonModel.findById(id);
    if (!lesson) throw new NotFoundException('Aula não encontrada');
    return lesson;
  }

  async update(id: string, dto: UpdateLessonDto, user: JwtUser) {
    const lesson = await this.findById(id);
    await this.assertModuleOwnership(lesson.moduleId.toString(), user);
    Object.assign(lesson, dto);
    await lesson.save();
    return lesson;
  }

  async remove(id: string, user: JwtUser) {
    const lesson = await this.findById(id);
    await this.assertModuleOwnership(lesson.moduleId.toString(), user);
    const attachments = await this.attachmentModel.find({ lessonId: id });
    await Promise.all(attachments.map((a) => this.storage.delete(a.storageKey)));
    await this.attachmentModel.deleteMany({ lessonId: id });
    await lesson.deleteOne();
  }

  /**
   * Passo 1 do upload direto: cria o vídeo no Bunny e devolve uma
   * assinatura de curta duração para o navegador enviar o arquivo direto
   * via TUS, sem passar pelo nosso backend.
   */
  async initVideoUpload(id: string, user: JwtUser) {
    const lesson = await this.findById(id);
    await this.assertModuleOwnership(lesson.moduleId.toString(), user);
    return this.bunnyStream.createDirectUpload(lesson.title);
  }

  /** Passo 2: o navegador confirma que o upload direto terminou. */
  async completeVideoUpload(id: string, dto: CompleteVideoUploadDto, user: JwtUser) {
    const lesson = await this.findById(id);
    await this.assertModuleOwnership(lesson.moduleId.toString(), user);
    const previousExternalId = lesson.video?.externalId;

    lesson.video = {
      provider: 'bunny',
      externalId: dto.videoId,
      playbackUrl: dto.playbackUrl,
      thumbnailUrl: dto.thumbnailUrl,
      durationSeconds: 0,
      status: 'processing',
    };
    await lesson.save();

    if (previousExternalId && previousExternalId !== dto.videoId) {
      await this.bunnyStream.deleteVideo(previousExternalId);
    }
    return lesson;
  }

  /** Remove o vídeo da aula (ex.: falha de transcodificação) sem excluir a aula em si. */
  async removeVideo(id: string, user: JwtUser) {
    const lesson = await this.findById(id);
    await this.assertModuleOwnership(lesson.moduleId.toString(), user);
    const externalId = lesson.video?.externalId;
    lesson.video = undefined;
    await lesson.save();
    if (externalId) {
      await this.bunnyStream.deleteVideo(externalId);
    }
    return lesson;
  }

  /** Usado pelo controller para checar matrícula: resolve a aula até o módulo dono. */
  async resolveModuleId(lessonId: string): Promise<string> {
    const lesson = await this.findById(lessonId);
    return lesson.moduleId.toString();
  }

  private async assertModuleOwnership(moduleId: string, user: JwtUser) {
    if (user.role === Role.ADMIN) return;
    const module = await this.moduleModel.findById(moduleId);
    if (!module) throw new NotFoundException('Módulo não encontrado');
    const course = await this.courseModel.findById(module.courseId);
    if (!course || course.teacherId.toString() !== user.userId) {
      throw new ForbiddenException('Você não tem acesso a este módulo');
    }
  }
}
