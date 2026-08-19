import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SettingsModule } from '../settings/settings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Lesson, LessonSchema } from '../lessons/schemas/lesson.schema';
import { BunnyStreamService } from './bunny-stream.service';
import { VideoController } from './video.controller';

@Module({
  imports: [
    SettingsModule,
    NotificationsModule,
    MongooseModule.forFeature([{ name: Lesson.name, schema: LessonSchema }]),
  ],
  controllers: [VideoController],
  providers: [BunnyStreamService],
  exports: [BunnyStreamService],
})
export class VideoModule {}
