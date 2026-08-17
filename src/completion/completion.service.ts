import { Injectable } from '@nestjs/common';
import { ProgressService } from '../progress/progress.service';
import { ExamsService } from '../exams/exams.service';
import { CertificatesService } from '../certificates/certificates.service';
import { ModulesService } from '../modules/modules.service';
import { CoursesService } from '../courses/courses.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class CompletionService {
  constructor(
    private progressService: ProgressService,
    private examsService: ExamsService,
    private certificatesService: CertificatesService,
    private modulesService: ModulesService,
    private coursesService: CoursesService,
    private usersService: UsersService,
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
}
