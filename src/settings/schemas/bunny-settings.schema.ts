import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BunnySettingsDocument = HydratedDocument<BunnySettings>;

@Schema({ timestamps: true })
export class BunnySettings {
  @Prop({ trim: true })
  libraryId?: string;

  @Prop()
  apiKey?: string;

  @Prop({ trim: true })
  pullZoneHostname?: string;

  @Prop({ default: false })
  enabled: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;
}

export const BunnySettingsSchema = SchemaFactory.createForClass(BunnySettings);
