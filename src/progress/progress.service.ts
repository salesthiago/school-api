import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LessonProgress, LessonProgressDocument } from './schemas/lesson-progress.schema';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { LessonDocument } from '../lessons/schemas/lesson.schema';
import { LessonsService } from '../lessons/lessons.service';
import { ModulesService } from '../modules/modules.service';
import { CoursesService } from '../courses/courses.service';
import { ExamsService } from '../exams/exams.service';

export interface ModuleProgressSummary {
  totalMandatoryLessons: number;
  completedLessons: number;
  percentage: number;
  nextLessonId: string | null;
  completedLessonIds: string[];
  /** 0 quando não existe prova pro escopo (módulo ou curso, conforme o caso) — nada é descontado. */
  examWeightPercent: number;
  /** null quando não existe prova; caso contrário, se o aluno já passou nela. */
  examPassed: boolean | null;
}

@Injectable()
export class ProgressService {
  constructor(
    @InjectModel(LessonProgress.name) private progressModel: Model<LessonProgressDocument>,
    private lessonsService: LessonsService,
    private modulesService: ModulesService,
    private coursesService: CoursesService,
    private examsService: ExamsService,
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
    const courseModule = await this.modulesService.findById(moduleId);
    const course = await this.coursesService.findById(courseModule.courseId.toString());
    const examStatus = await this.examsService.getFinalExamStatus(moduleId, studentId);
    return this.summarize(studentId, lessons, course.examWeightPercent, examStatus);
  }

  /** Conclusão da trilha de aulas avulsas do curso (aulas sem módulo). */
  async getCourseTrackSummary(studentId: string, courseId: string): Promise<ModuleProgressSummary> {
    const lessons = await this.lessonsService.findLooseByCourse(courseId);
    const course = await this.coursesService.findById(courseId);
    const examStatus = await this.examsService.getFinalExamStatusForCourse(courseId, studentId);
    return this.summarize(studentId, lessons, course.examWeightPercent, examStatus);
  }

  private async summarize(
    studentId: string,
    lessons: LessonDocument[],
    examWeightPercent: number,
    examStatus: { exists: boolean; passed: boolean },
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

    const lessonsPercentage = mandatoryLessons.length
      ? Math.round((completedIds.size / mandatoryLessons.length) * 100)
      : 0;

    const hasExam = examStatus.exists;
    const weight = hasExam ? Math.min(100, Math.max(0, examWeightPercent)) / 100 : 0;
    const examPercentage = examStatus.passed ? 100 : 0;
    const percentage = hasExam
      ? Math.round(lessonsPercentage * (1 - weight) + examPercentage * weight)
      : lessonsPercentage;

    return {
      totalMandatoryLessons: mandatoryLessons.length,
      completedLessons: completedIds.size,
      percentage,
      nextLessonId: nextLesson?.id ?? null,
      completedLessonIds: [...completedIds],
      examWeightPercent: hasExam ? examWeightPercent : 0,
      examPassed: hasExam ? examStatus.passed : null,
    };
  }
}
