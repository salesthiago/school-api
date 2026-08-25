import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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
import { idFilter } from '../common/utils/mongo-id.util';

export interface LessonAccessKey {
  courseId: string;
  moduleId?: string;
}

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
    await this.assertOwnership(dto.courseId, teacher);
    if (dto.moduleId) {
      await this.assertModuleBelongsToCourse(dto.moduleId, dto.courseId);
    }
    return this.lessonModel.create({
      ...dto,
      courseId: new Types.ObjectId(dto.courseId),
      moduleId: dto.moduleId ? new Types.ObjectId(dto.moduleId) : undefined,
      teacherId: teacher.userId,
    });
  }

  findByModule(moduleId: string) {
    return this.lessonModel.find(idFilter('$moduleId', moduleId)).sort({ order: 1 });
  }

  /** Todas as aulas do curso (soltas + de módulo) — usado pela tela de gestão de conteúdo do curso. */
  findByCourse(courseId: string) {
    return this.lessonModel.find(idFilter('$courseId', courseId)).sort({ order: 1 });
  }

  /** Só as aulas avulsas (sem módulo) do curso, na trilha vendável separadamente dos módulos. */
  findLooseByCourse(courseId: string) {
    return this.lessonModel
      .find({ ...idFilter('$courseId', courseId), moduleId: null })
      .sort({ order: 1 });
  }

  countMandatoryByModule(moduleId: string) {
    return this.lessonModel.countDocuments({
      ...idFilter('$moduleId', moduleId),
      mandatory: true,
      published: true,
    });
  }

  countMandatoryLooseByCourse(courseId: string) {
    return this.lessonModel.countDocuments({
      ...idFilter('$courseId', courseId),
      moduleId: null,
      mandatory: true,
      published: true,
    });
  }

  async findById(id: string): Promise<LessonDocument> {
    const lesson = await this.lessonModel.findById(id);
    if (!lesson) throw new NotFoundException('Aula não encontrada');
    return lesson;
  }

  async update(id: string, dto: UpdateLessonDto, user: JwtUser) {
    const lesson = await this.findById(id);
    await this.assertOwnership(lesson.courseId.toString(), user);
    if (dto.moduleId) {
      await this.assertModuleBelongsToCourse(dto.moduleId, lesson.courseId.toString());
    }
    // courseId de uma aula não muda por aqui — só organização dentro do curso (moduleId).
    const { courseId: _ignoredCourseId, moduleId, ...patch } = dto;
    Object.assign(lesson, patch);
    if ('moduleId' in dto) {
      lesson.moduleId = moduleId ? new Types.ObjectId(moduleId) : undefined;
    }
    await lesson.save();
    return lesson;
  }

  async remove(id: string, user: JwtUser) {
    const lesson = await this.findById(id);
    await this.assertOwnership(lesson.courseId.toString(), user);
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
    await this.assertOwnership(lesson.courseId.toString(), user);
    return this.bunnyStream.createDirectUpload(lesson.title);
  }

  /** Passo 2: o navegador confirma que o upload direto terminou. */
  async completeVideoUpload(id: string, dto: CompleteVideoUploadDto, user: JwtUser) {
    const lesson = await this.findById(id);
    await this.assertOwnership(lesson.courseId.toString(), user);
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
    await this.assertOwnership(lesson.courseId.toString(), user);
    const externalId = lesson.video?.externalId;
    lesson.video = undefined;
    await lesson.save();
    if (externalId) {
      await this.bunnyStream.deleteVideo(externalId);
    }
    return lesson;
  }

  /** Usado pelos controllers pra checar matrícula: resolve a aula até curso + (opcional) módulo dono. */
  async getAccessKey(lessonId: string): Promise<LessonAccessKey> {
    const lesson = await this.findById(lessonId);
    return {
      courseId: lesson.courseId.toString(),
      moduleId: lesson.moduleId?.toString(),
    };
  }

  /** Usado pelo controller pra checar matrícula quando a listagem é feita por moduleId direto. */
  async resolveModuleAccessKey(moduleId: string): Promise<LessonAccessKey> {
    const module = await this.moduleModel.findById(moduleId);
    if (!module) throw new NotFoundException('Módulo não encontrado');
    return { courseId: module.courseId.toString(), moduleId };
  }

  private async assertModuleBelongsToCourse(moduleId: string, courseId: string) {
    const module = await this.moduleModel.findById(moduleId);
    if (!module) throw new NotFoundException('Módulo não encontrado');
    if (module.courseId.toString() !== courseId) {
      throw new BadRequestException('O módulo informado não pertence a este curso');
    }
  }

  private async assertOwnership(courseId: string, user: JwtUser) {
    if (user.role === Role.ADMIN) return;
    const course = await this.courseModel.findById(courseId);
    if (!course) throw new NotFoundException('Curso não encontrado');
    if (course.teacherId.toString() !== user.userId) {
      throw new ForbiddenException('Você não tem acesso a este curso');
    }
  }
}
