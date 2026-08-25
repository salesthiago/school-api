import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { idFilter } from '../common/utils/mongo-id.util';
import { CourseModule, CourseModuleDocument } from './schemas/module.schema';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import { Lesson, LessonDocument } from '../lessons/schemas/lesson.schema';
import { Attachment, AttachmentDocument } from '../attachments/schemas/attachment.schema';
import { Enrollment, EnrollmentDocument } from '../enrollments/schemas/enrollment.schema';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { JwtUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { STORAGE_PROVIDER, StorageProvider } from '../storage/storage-provider.interface';

const COVER_URL_TTL_SECONDS = 60 * 60;

@Injectable()
export class ModulesService {
  constructor(
    @InjectModel(CourseModule.name) private moduleModel: Model<CourseModuleDocument>,
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
    @InjectModel(Lesson.name) private lessonModel: Model<LessonDocument>,
    @InjectModel(Attachment.name) private attachmentModel: Model<AttachmentDocument>,
    @InjectModel(Enrollment.name) private enrollmentModel: Model<EnrollmentDocument>,
    @Inject(STORAGE_PROVIDER) private storage: StorageProvider,
  ) {}

  async create(dto: CreateModuleDto, user: JwtUser) {
    await this.assertCourseOwnership(dto.courseId, user);
    const module = await this.moduleModel.create({
      ...dto,
      courseId: new Types.ObjectId(dto.courseId),
      price: dto.free ? 0 : dto.price,
    });
    return this.toPublic(module);
  }

  async findByCourse(courseId: string) {
    const modules = await this.moduleModel.find(idFilter('$courseId', courseId)).sort({ order: 1 });
    return Promise.all(modules.map((m) => this.toPublic(m)));
  }

  async findById(id: string): Promise<CourseModuleDocument> {
    const module = await this.moduleModel.findById(id);
    if (!module) throw new NotFoundException('Módulo não encontrado');
    return module;
  }

  async findByIdPublic(id: string) {
    const module = await this.findById(id);
    return this.toPublic(module);
  }

  async update(id: string, dto: UpdateModuleDto, user: JwtUser) {
    const module = await this.findById(id);
    await this.assertCourseOwnership(module.courseId.toString(), user);
    if (dto.published && !module.published) {
      const lessonCount = await this.lessonModel.countDocuments(idFilter('$moduleId', id));
      if (lessonCount === 0) {
        throw new BadRequestException('O módulo precisa de pelo menos uma aula para ser publicado');
      }
    }
    Object.assign(module, dto);
    if (dto.free) module.price = 0;
    await module.save();
    return this.toPublic(module);
  }

  /** Exclui o módulo e tudo que depende dele: aulas, anexos (com storage) e matrículas. */
  async remove(id: string, user: JwtUser) {
    const module = await this.findById(id);
    await this.assertCourseOwnership(module.courseId.toString(), user);

    const lessons = await this.lessonModel.find(idFilter('$moduleId', id)).select('_id');
    // Referências entre coleções neste projeto são gravadas como string, não
    // ObjectId de fato (schema-wide, ver nota em Types.ObjectId) — usar
    // string aqui para o $in bater com o que está persistido.
    const lessonIds = lessons.map((l) => l._id.toString());

    const attachments = await this.attachmentModel.find({ lessonId: { $in: lessonIds } });
    await Promise.all(attachments.map((a) => this.storage.delete(a.storageKey)));
    await this.attachmentModel.deleteMany({ lessonId: { $in: lessonIds } });

    await this.lessonModel.deleteMany(idFilter('$moduleId', id));
    await this.enrollmentModel.deleteMany(idFilter('$moduleId', id));
    await module.deleteOne();
  }

  async uploadCover(
    id: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
    user: JwtUser,
  ) {
    const module = await this.findById(id);
    await this.assertCourseOwnership(module.courseId.toString(), user);
    const previousKey = module.coverImageKey;
    const key = `modules/${id}/${randomUUID()}-${file.originalname}`;
    const { storageKey } = await this.storage.upload(key, file.buffer, file.mimetype);
    module.coverImageKey = storageKey;
    await module.save();
    if (previousKey) {
      await this.storage.delete(previousKey);
    }
    return this.toPublic(module);
  }

  async assertCourseOwnership(courseId: string, user: JwtUser) {
    if (user.role === Role.ADMIN) return;
    const course = await this.courseModel.findById(courseId);
    if (!course) throw new NotFoundException('Curso não encontrado');
    if (course.teacherId.toString() !== user.userId) {
      throw new ForbiddenException('Você não tem acesso a este curso');
    }
  }

  private async toPublic(module: CourseModuleDocument) {
    const { coverImageKey, ...json } = module.toJSON() as unknown as Record<string, unknown> & {
      coverImageKey?: string;
    };
    return {
      ...json,
      coverImageUrl: coverImageKey
        ? await this.storage.getSignedUrl(coverImageKey, COVER_URL_TTL_SECONDS)
        : undefined,
    };
  }
}
