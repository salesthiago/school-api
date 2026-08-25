import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Course, CourseSchema } from './schemas/course.schema';
import { Lesson, LessonSchema } from '../lessons/schemas/lesson.schema';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { StorageModule } from '../storage/storage.module';
import { ModulesModule } from '../modules/modules.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Course.name, schema: CourseSchema },
      { name: Lesson.name, schema: LessonSchema },
    ]),
    StorageModule,
    ModulesModule,
  ],
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
