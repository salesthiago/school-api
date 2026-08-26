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
        type: 'module',
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
   * a prova de curso inteiro (scope COURSE) só trava o certificado 'full', não o 'track'.
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
        type: 'track',
        moduleTitle: course.title,
        courseId: course.id,
        teacherName: teacher.name,
        workloadHours,
      });
      certificateId = certificate.id;
    }

    return { lessonsDone: completed, completed, progress: summary, certificateId };
  }

  /**
   * Conclusão do curso inteiro: todos os módulos publicados + trilha de aulas avulsas (quando
   * existir) concluídos, mais a prova final do curso (scope COURSE), quando configurada. Como
   * passa por TODOS os módulos publicados (não só os que o aluno comprou), só fecha se o aluno
   * tiver o curso completo — leitura literal do pedido do professor.
   */
  async checkCourseFull(studentId: string, courseId: string) {
    const allModules = (await this.modulesService.findByCourse(courseId)) as unknown as Array<{
      id: string;
      title: string;
      published: boolean;
      workloadHours: number;
    }>;
    const modules = allModules.filter((m) => m.published);
    const moduleResults = await Promise.all(
      modules.map(async (m) => ({
        moduleId: m.id,
        title: m.title,
        completed: (await this.checkModule(studentId, m.id)).completed,
      })),
    );

    const looseLessons = await this.lessonsService.findLooseByCourse(courseId);
    const hasTrack = looseLessons.length > 0;
    const trackResult = hasTrack ? await this.checkCourseTrack(studentId, courseId) : null;

    const hasAnyContent = modules.length > 0 || hasTrack;
    const allModulesDone = moduleResults.every((r) => r.completed);
    const trackDone = !hasTrack || !!trackResult?.completed;
    const examStatus = await this.examsService.getFinalExamStatusForCourse(courseId, studentId);

    const completed = hasAnyContent && allModulesDone && trackDone && examStatus.passed;

    let certificateId: string | undefined;
    if (completed) {
      const course = await this.coursesService.findById(courseId);
      const student = await this.usersService.findById(studentId);
      const teacher = await this.usersService.findById(course.teacherId.toString());
      const moduleHours = modules.reduce((sum, m) => sum + (Number(m.workloadHours) || 0), 0);
      const trackHours = hasTrack
        ? Math.round(looseLessons.reduce((sum, l) => sum + (l.video?.durationSeconds ?? 0), 0) / 3600)
        : 0;

      const certificate = await this.certificatesService.generate({
        studentId,
        studentName: student.name,
        type: 'full',
        moduleTitle: course.title,
        courseId: course.id,
        teacherName: teacher.name,
        workloadHours: moduleHours + trackHours,
      });
      certificateId = certificate.id;
    }

    return { modules: moduleResults, track: trackResult, exam: examStatus, completed, certificateId };
  }
}
