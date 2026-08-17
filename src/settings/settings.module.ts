import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BunnySettings, BunnySettingsSchema } from './schemas/bunny-settings.schema';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: BunnySettings.name, schema: BunnySettingsSchema }]),
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
