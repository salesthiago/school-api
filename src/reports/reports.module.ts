import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { Lesson, LessonSchema } from '../lessons/schemas/lesson.schema';
import { LessonProgress, LessonProgressSchema } from '../progress/schemas/lesson-progress.schema';
import { Enrollment, EnrollmentSchema } from '../enrollments/schemas/enrollment.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Exam, ExamSchema } from '../exams/schemas/exam.schema';
import { ExamAttempt, ExamAttemptSchema } from '../exams/schemas/exam-attempt.schema';
import { Certificate, CertificateSchema } from '../certificates/schemas/certificate.schema';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Course.name, schema: CourseSchema },
      { name: Lesson.name, schema: LessonSchema },
      { name: LessonProgress.name, schema: LessonProgressSchema },
      { name: Enrollment.name, schema: EnrollmentSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Exam.name, schema: ExamSchema },
      { name: ExamAttempt.name, schema: ExamAttemptSchema },
      { name: Certificate.name, schema: CertificateSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
