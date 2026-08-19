import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Lesson, LessonSchema } from './schemas/lesson.schema';
import { CourseModule, CourseModuleSchema } from '../modules/schemas/module.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { Attachment, AttachmentSchema } from '../attachments/schemas/attachment.schema';
import { LessonsService } from './lessons.service';
import { LessonsController } from './lessons.controller';
import { VideoModule } from '../video/video.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Lesson.name, schema: LessonSchema },
      { name: CourseModule.name, schema: CourseModuleSchema },
      { name: Course.name, schema: CourseSchema },
      { name: Attachment.name, schema: AttachmentSchema },
    ]),
    VideoModule,
    EnrollmentsModule,
    StorageModule,
  ],
  controllers: [LessonsController],
  providers: [LessonsService],
  exports: [LessonsService],
})
export class LessonsModule {}
