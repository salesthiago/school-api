import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BunnySettings, BunnySettingsDocument } from './schemas/bunny-settings.schema';
import { UpdateBunnySettingsDto } from './dto/update-bunny-settings.dto';

export interface BunnyPublicSettings {
  libraryId: string | null;
  pullZoneHostname: string | null;
  enabled: boolean;
  apiKeyConfigured: boolean;
}

export interface BunnyProviderConfig {
  libraryId: string;
  apiKey: string;
  pullZoneHostname?: string;
}

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(BunnySettings.name) private bunnySettingsModel: Model<BunnySettingsDocument>,
  ) {}

  async getBunnySettings(): Promise<BunnyPublicSettings> {
    const doc = await this.getOrCreateDefault();
    return {
      libraryId: doc.libraryId ?? null,
      pullZoneHostname: doc.pullZoneHostname ?? null,
      enabled: doc.enabled,
      apiKeyConfigured: !!doc.apiKey,
    };
  }

  async updateBunnySettings(
    dto: UpdateBunnySettingsDto,
    userId: string,
  ): Promise<BunnyPublicSettings> {
    const doc = await this.getOrCreateDefault();
    if (dto.libraryId !== undefined) doc.libraryId = dto.libraryId;
    if (dto.pullZoneHostname !== undefined) doc.pullZoneHostname = dto.pullZoneHostname;
    if (dto.enabled !== undefined) doc.enabled = dto.enabled;
    if (dto.apiKey) doc.apiKey = dto.apiKey;
    doc.updatedBy = new Types.ObjectId(userId);
    await doc.save();
    return this.getBunnySettings();
  }

  async getBunnyProviderConfig(): Promise<BunnyProviderConfig | null> {
    const doc = await this.getOrCreateDefault();
    if (!doc.enabled || !doc.libraryId || !doc.apiKey) return null;
    return { libraryId: doc.libraryId, apiKey: doc.apiKey, pullZoneHostname: doc.pullZoneHostname };
  }

  private async getOrCreateDefault(): Promise<BunnySettingsDocument> {
    const existing = await this.bunnySettingsModel.findOne();
    if (existing) return existing;
    return this.bunnySettingsModel.create({});
  }
}
