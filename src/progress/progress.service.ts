import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LessonProgress, LessonProgressDocument } from './schemas/lesson-progress.schema';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { LessonDocument } from '../lessons/schemas/lesson.schema';
import { LessonsService } from '../lessons/lessons.service';
import { ModulesService } from '../modules/modules.service';
import { CoursesService } from '../courses/courses.service';

export interface ModuleProgressSummary {
  totalMandatoryLessons: number;
  completedLessons: number;
  percentage: number;
  nextLessonId: string | null;
}

@Injectable()
export class ProgressService {
  constructor(
    @InjectModel(LessonProgress.name) private progressModel: Model<LessonProgressDocument>,
    private lessonsService: LessonsService,
    private modulesService: ModulesService,
    private coursesService: CoursesService,
  ) {}

  async upsert(studentId: string, dto: UpdateProgressDto) {
    const lesson = await this.lessonsService.findById(dto.lessonId);
    const threshold = dto.moduleId
      ? (await this.modulesService.findById(dto.moduleId)).completionThresholdPercent
      : (await this.coursesService.findById(lesson.courseId.toString())).completionThresholdPercent;

    const percentage = Math.min(
      100,
      Math.round((dto.watchedSeconds / Math.max(lesson.video?.durationSeconds ?? 0, 1)) * 100),
    );
    const completed = percentage >= threshold;

    const existing = await this.progressModel.findOne({
      studentId,
      lessonId: dto.lessonId,
    });
    const wasCompleted = existing?.completed ?? false;

    return this.progressModel.findOneAndUpdate(
      { studentId, lessonId: dto.lessonId },
      {
        studentId,
        lessonId: dto.lessonId,
        moduleId: dto.moduleId ?? null,
        watchedSeconds: dto.watchedSeconds,
        percentage,
        completed,
        ...(completed && !wasCompleted ? { completedAt: new Date() } : {}),
      },
      { upsert: true, new: true },
    );
  }

  async getModuleSummary(studentId: string, moduleId: string): Promise<ModuleProgressSummary> {
    const lessons = await this.lessonsService.findByModule(moduleId);
    return this.summarize(studentId, lessons);
  }

  /** Conclusão da trilha de aulas avulsas do curso (aulas sem módulo). */
  async getCourseTrackSummary(studentId: string, courseId: string): Promise<ModuleProgressSummary> {
    const lessons = await this.lessonsService.findLooseByCourse(courseId);
    return this.summarize(studentId, lessons);
  }

  private async summarize(
    studentId: string,
    lessons: LessonDocument[],
  ): Promise<ModuleProgressSummary> {
    const mandatoryLessons = lessons.filter((l) => l.mandatory && l.published);
    const mandatoryIds = mandatoryLessons.map((l) => l.id);

    const completedDocs = await this.progressModel.find({
      studentId,
      lessonId: { $in: mandatoryIds },
      completed: true,
    });
    const completedIds = new Set(completedDocs.map((d) => d.lessonId.toString()));

    const nextLesson = mandatoryLessons.find((l) => !completedIds.has(l.id));

    return {
      totalMandatoryLessons: mandatoryLessons.length,
      completedLessons: completedIds.size,
      percentage: mandatoryLessons.length
        ? Math.round((completedIds.size / mandatoryLessons.length) * 100)
        : 0,
      nextLessonId: nextLesson?.id ?? null,
    };
  }
}
