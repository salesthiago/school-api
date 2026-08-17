import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Lesson, LessonDocument } from './schemas/lesson.schema';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { JwtUser } from '../common/decorators/current-user.decorator';
import { BunnyStreamService } from '../video/bunny-stream.service';

@Injectable()
export class LessonsService {
  constructor(
    @InjectModel(Lesson.name) private lessonModel: Model<LessonDocument>,
    private readonly bunnyStream: BunnyStreamService,
  ) {}

  create(dto: CreateLessonDto, teacher: JwtUser) {
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

  async update(id: string, dto: UpdateLessonDto) {
    const lesson = await this.lessonModel.findByIdAndUpdate(id, dto, { new: true });
    if (!lesson) throw new NotFoundException('Aula não encontrada');
    return lesson;
  }

  async remove(id: string) {
    const result = await this.lessonModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException('Aula não encontrada');
  }

  async uploadVideo(id: string, file: { originalname: string; buffer: Buffer }) {
    const lesson = await this.findById(id);
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
}
