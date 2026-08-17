import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Course, CourseDocument } from './schemas/course.schema';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { JwtUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class CoursesService {
  constructor(@InjectModel(Course.name) private courseModel: Model<CourseDocument>) {}

  create(dto: CreateCourseDto, teacher: JwtUser) {
    return this.courseModel.create({
      ...dto,
      teacherId: teacher.userId,
      institutionId: teacher.institutionId,
    });
  }

  findPublished(institutionId?: string) {
    const filter: Record<string, unknown> = { published: true };
    if (institutionId) filter.institutionId = institutionId;
    return this.courseModel.find(filter).populate('teacherId', 'name');
  }

  findAllForTeacher(teacherId: string) {
    return this.courseModel.find({ teacherId });
  }

  async findById(id: string): Promise<CourseDocument> {
    const course = await this.courseModel.findById(id);
    if (!course) throw new NotFoundException('Curso não encontrado');
    return course;
  }

  async update(id: string, dto: UpdateCourseDto, user: JwtUser) {
    const course = await this.findById(id);
    this.assertOwnership(course, user);
    Object.assign(course, dto);
    return course.save();
  }

  async remove(id: string, user: JwtUser) {
    const course = await this.findById(id);
    this.assertOwnership(course, user);
    await course.deleteOne();
  }

  private assertOwnership(course: CourseDocument, user: JwtUser) {
    if (user.role === Role.ADMIN) return;
    if (course.teacherId.toString() !== user.userId) {
      throw new ForbiddenException('Você não tem acesso a este curso');
    }
  }
}
