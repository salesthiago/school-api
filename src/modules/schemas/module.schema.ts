import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CourseModuleDocument = HydratedDocument<CourseModule>;

@Schema({ timestamps: true, collection: 'modules' })
export class CourseModule {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  courseId: Types.ObjectId;

  @Prop({ required: true, default: 0 })
  order: number;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ default: false })
  free: boolean;

  @Prop({ default: false })
  published: boolean;

  @Prop({ default: 90, min: 1, max: 100 })
  completionThresholdPercent: number;

  @Prop({ default: 0, min: 0 })
  workloadHours: number;

  @Prop()
  coverImageKey?: string;
}

export const CourseModuleSchema = SchemaFactory.createForClass(CourseModule);
