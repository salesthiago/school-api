import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LessonDocument = HydratedDocument<Lesson>;

@Schema({ _id: false })
export class VideoMeta {
  @Prop({ required: true })
  provider: string;

  @Prop({ required: true })
  externalId: string;

  @Prop()
  playbackUrl?: string;

  @Prop({ required: true, min: 0 })
  durationSeconds: number;

  @Prop()
  thumbnailUrl?: string;

  /** 'processing' assim que o upload direto termina; o Bunny confirma via webhook. */
  @Prop({ enum: ['processing', 'ready', 'error'], default: 'processing' })
  status?: string;
}
export const VideoMetaSchema = SchemaFactory.createForClass(VideoMeta);

@Schema({ timestamps: true })
export class Lesson {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'CourseModule', required: true, index: true })
  moduleId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  teacherId: Types.ObjectId;

  @Prop({ type: VideoMetaSchema })
  video?: VideoMeta;

  @Prop({ required: true, default: 0 })
  order: number;

  @Prop({ default: true })
  mandatory: boolean;

  @Prop({ default: false })
  published: boolean;
}

export const LessonSchema = SchemaFactory.createForClass(Lesson);
