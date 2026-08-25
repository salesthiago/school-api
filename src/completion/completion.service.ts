import { Injectable } from '@nestjs/common';
import { ProgressService } from '../progress/progress.service';
import { ExamsService } from '../exams/exams.service';
import { CertificatesService } from '../certificates/certificates.service';
import { ModulesService } from '../modules/modules.service';
import { CoursesService } from '../courses/courses.service';
import { UsersService } from '../users/users.service';
import { LessonsService } from '../lessons/lessons.service';

@Injectable()
export class CompletionService {
  constructor(
    private progressService: ProgressService,
    private examsService: ExamsService,
    private certificatesService: CertificatesService,
    private modulesService: ModulesService,
    private coursesService: CoursesService,
    private usersService: UsersService,
    private lessonsService: LessonsService,
  ) {}

  async checkModule(studentId: string, moduleId: string) {
    const summary = await this.progressService.getModuleSummary(studentId, moduleId);
    const lessonsDone =
      summary.totalMandatoryLessons > 0 && summary.completedLessons === summary.totalMandatoryLessons;

    const examStatus = await this.examsService.getFinalExamStatus(moduleId, studentId);
    const completed = lessonsDone && examStatus.passed;

    let certificateId: string | undefined;
    if (completed) {
      const courseModule = await this.modulesService.findById(moduleId);
      const course = await this.coursesService.findById(courseModule.courseId.toString());
      const student = await this.usersService.findById(studentId);
      const teacher = await this.usersService.findById(course.teacherId.toString());

      const certificate = await this.certificatesService.generate({
        studentId,
        studentName: student.name,
        moduleId,
        moduleTitle: courseModule.title,
        courseId: course.id,
        teacherName: teacher.name,
        workloadHours: courseModule.workloadHours,
      });
      certificateId = certificate.id;
    }

    return { lessonsDone, exam: examStatus, completed, progress: summary, certificateId };
  }

  /**
   * Conclusão da trilha de aulas avulsas do curso (aulas sem módulo). Sem gate de prova —
   * o schema de Exam não suporta escopo de curso hoje (só lesson/module).
   */
  async checkCourseTrack(studentId: string, courseId: string) {
    const summary = await this.progressService.getCourseTrackSummary(studentId, courseId);
    const completed =
      summary.totalMandatoryLessons > 0 && summary.completedLessons === summary.totalMandatoryLessons;

    let certificateId: string | undefined;
    if (completed) {
      const course = await this.coursesService.findById(courseId);
      const student = await this.usersService.findById(studentId);
      const teacher = await this.usersService.findById(course.teacherId.toString());
      const looseLessons = await this.lessonsService.findLooseByCourse(courseId);
      const workloadHours = Math.round(
        looseLessons.reduce((sum, l) => sum + (l.video?.durationSeconds ?? 0), 0) / 3600,
      );

      const certificate = await this.certificatesService.generate({
        studentId,
        studentName: student.name,
        moduleTitle: course.title,
        courseId: course.id,
        teacherName: teacher.name,
        workloadHours,
      });
      certificateId = certificate.id;
    }

    return { lessonsDone: completed, completed, progress: summary, certificateId };
  }
}
