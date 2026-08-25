import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LessonProgress, LessonProgressSchema } from './schemas/lesson-progress.schema';
import { ProgressService } from './progress.service';
import { ProgressController } from './progress.controller';
import { LessonsModule } from '../lessons/lessons.module';
import { ModulesModule } from '../modules/modules.module';
import { CoursesModule } from '../courses/courses.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: LessonProgress.name, schema: LessonProgressSchema }]),
    LessonsModule,
    ModulesModule,
    CoursesModule,
  ],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class ProgressModule {}
