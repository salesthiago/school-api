import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LessonProgressDocument = HydratedDocument<LessonProgress>;

@Schema({ timestamps: true, collection: 'lessonProgress' })
export class LessonProgress {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  studentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Lesson', required: true, index: true })
  lessonId: Types.ObjectId;

  /** Ausente quando a aula é avulsa (sem módulo). */
  @Prop({ type: Types.ObjectId, ref: 'CourseModule', required: false, index: true })
  moduleId?: Types.ObjectId;

  @Prop({ required: true, default: 0, min: 0 })
  watchedSeconds: number;

  @Prop({ required: true, default: 0, min: 0, max: 100 })
  percentage: number;

  @Prop({ default: false })
  completed: boolean;

  @Prop()
  completedAt?: Date;
}

export const LessonProgressSchema = SchemaFactory.createForClass(LessonProgress);
LessonProgressSchema.index({ studentId: 1, lessonId: 1 }, { unique: true });
