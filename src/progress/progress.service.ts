import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LessonProgress, LessonProgressDocument } from './schemas/lesson-progress.schema';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { LessonsService } from '../lessons/lessons.service';
import { ModulesService } from '../modules/modules.service';

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
  ) {}

  async upsert(studentId: string, dto: UpdateProgressDto) {
    const lesson = await this.lessonsService.findById(dto.lessonId);
    const courseModule = await this.modulesService.findById(dto.moduleId);

    const percentage = Math.min(
      100,
      Math.round((dto.watchedSeconds / Math.max(lesson.video?.durationSeconds ?? 0, 1)) * 100),
    );
    const completed = percentage >= courseModule.completionThresholdPercent;

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
        moduleId: dto.moduleId,
        watchedSeconds: dto.watchedSeconds,
        percentage,
        completed,
        ...(completed && !wasCompleted ? { completedAt: new Date() } : {}),
      },
      { upsert: true, new: true },
    );
  }

  async getModuleSummary(studentId: string, moduleId: string): Promise<ModuleProgressSummary> {
    const mandatoryLessons = (await this.lessonsService.findByModule(moduleId)).filter(
      (l) => l.mandatory && l.published,
    );
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
