import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { Course, CourseDocument } from './schemas/course.schema';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { JwtUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { STORAGE_PROVIDER, StorageProvider } from '../storage/storage-provider.interface';
import { ModulesService } from '../modules/modules.service';

const COVER_URL_TTL_SECONDS = 60 * 60;

@Injectable()
export class CoursesService {
  constructor(
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
    @Inject(STORAGE_PROVIDER) private storage: StorageProvider,
    private modulesService: ModulesService,
  ) {}

  async create(dto: CreateCourseDto, teacher: JwtUser) {
    const course = await this.courseModel.create({
      ...dto,
      teacherId: teacher.userId,
      institutionId: teacher.institutionId,
    });
    return this.toPublic(course);
  }

  async findPublished(institutionId?: string) {
    const filter: Record<string, unknown> = { published: true };
    if (institutionId) filter.institutionId = institutionId;
    const courses = await this.courseModel.find(filter).populate('teacherId', 'name');
    return Promise.all(courses.map((c) => this.toPublic(c)));
  }

  /** Professor vê só os próprios cursos; admin vê todos, para poder gerenciar a plataforma inteira. */
  async findMine(user: JwtUser) {
    const filter = user.role === Role.ADMIN ? {} : { teacherId: user.userId };
    const courses = await this.courseModel.find(filter).populate('teacherId', 'name');
    return Promise.all(courses.map((c) => this.toPublic(c)));
  }

  async findById(id: string): Promise<CourseDocument> {
    const course = await this.courseModel.findById(id);
    if (!course) throw new NotFoundException('Curso não encontrado');
    return course;
  }

  async findByIdPublic(id: string) {
    const course = await this.findById(id);
    return this.toPublic(course);
  }

  async update(id: string, dto: UpdateCourseDto, user: JwtUser) {
    const course = await this.findById(id);
    this.assertOwnership(course, user);
    Object.assign(course, dto);
    await course.save();
    return this.toPublic(course);
  }

  /** Exclui o curso e cada módulo (que por sua vez cascateia aulas/anexos/matrículas). */
  async remove(id: string, user: JwtUser) {
    const course = await this.findById(id);
    this.assertOwnership(course, user);
    const modules = await this.modulesService.findByCourse(id);
    for (const module of modules as unknown as { id: string }[]) {
      await this.modulesService.remove(module.id, user);
    }
    if (course.coverImageKey) {
      await this.storage.delete(course.coverImageKey);
    }
    await course.deleteOne();
  }

  async uploadCover(id: string, file: { buffer: Buffer; mimetype: string; originalname: string }, user: JwtUser) {
    const course = await this.findById(id);
    this.assertOwnership(course, user);
    const previousKey = course.coverImageKey;
    const key = `courses/${id}/${randomUUID()}-${file.originalname}`;
    const { storageKey } = await this.storage.upload(key, file.buffer, file.mimetype);
    course.coverImageKey = storageKey;
    await course.save();
    if (previousKey) {
      await this.storage.delete(previousKey);
    }
    return this.toPublic(course);
  }

  assertOwnership(course: CourseDocument, user: JwtUser) {
    if (user.role === Role.ADMIN) return;
    if (course.teacherId.toString() !== user.userId) {
      throw new ForbiddenException('Você não tem acesso a este curso');
    }
  }

  private async toPublic(course: CourseDocument) {
    const { coverImageKey, ...json } = course.toJSON() as unknown as Record<string, unknown> & {
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
