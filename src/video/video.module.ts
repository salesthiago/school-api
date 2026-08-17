import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { BunnyStreamService } from './bunny-stream.service';

@Module({
  imports: [SettingsModule],
  providers: [BunnyStreamService],
  exports: [BunnyStreamService],
})
export class VideoModule {}
