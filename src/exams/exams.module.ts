import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Exam, ExamSchema } from './schemas/exam.schema';
import { Question, QuestionSchema } from './schemas/question.schema';
import { ExamAttempt, ExamAttemptSchema } from './schemas/exam-attempt.schema';
import { CourseModule, CourseModuleSchema } from '../modules/schemas/module.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { Lesson, LessonSchema } from '../lessons/schemas/lesson.schema';
import { ExamsService } from './exams.service';
import { ExamsController } from './exams.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Exam.name, schema: ExamSchema },
      { name: Question.name, schema: QuestionSchema },
      { name: ExamAttempt.name, schema: ExamAttemptSchema },
      { name: CourseModule.name, schema: CourseModuleSchema },
      { name: Course.name, schema: CourseSchema },
      { name: Lesson.name, schema: LessonSchema },
    ]),
  ],
  controllers: [ExamsController],
  providers: [ExamsService],
  exports: [ExamsService],
})
export class ExamsModule {}
