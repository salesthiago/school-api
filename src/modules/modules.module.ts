import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CourseModule, CourseModuleSchema } from './schemas/module.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { Lesson, LessonSchema } from '../lessons/schemas/lesson.schema';
import { Attachment, AttachmentSchema } from '../attachments/schemas/attachment.schema';
import { Enrollment, EnrollmentSchema } from '../enrollments/schemas/enrollment.schema';
import { ModulesService } from './modules.service';
import { ModulesController } from './modules.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CourseModule.name, schema: CourseModuleSchema },
      { name: Course.name, schema: CourseSchema },
      { name: Lesson.name, schema: LessonSchema },
      { name: Attachment.name, schema: AttachmentSchema },
      { name: Enrollment.name, schema: EnrollmentSchema },
    ]),
    StorageModule,
  ],
  controllers: [ModulesController],
  providers: [ModulesService],
  exports: [ModulesService],
})
export class ModulesModule {}
