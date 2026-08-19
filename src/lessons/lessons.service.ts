import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Lesson, LessonDocument } from './schemas/lesson.schema';
import { CourseModule, CourseModuleDocument } from '../modules/schemas/module.schema';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import { Attachment, AttachmentDocument } from '../attachments/schemas/attachment.schema';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
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

  async uploadVideo(id: string, file: { originalname: string; buffer: Buffer }, user: JwtUser) {
    const lesson = await this.findById(id);
    await this.assertModuleOwnership(lesson.moduleId.toString(), user);
    const uploaded = await this.bunnyStream.uploadVideo(file.originalname, file.buffer);
    lesson.video = {
      provider: 'bunny',
      externalId: uploaded.externalId,
      playbackUrl: uploaded.playbackUrl,
      thumbnailUrl: uploaded.thumbnailUrl,
      durationSeconds: lesson.video?.durationSeconds ?? 0,
    };
    await lesson.save();
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
