import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ExamDocument = HydratedDocument<Exam>;

export enum ExamScope {
  LESSON = 'lesson',
  MODULE = 'module',
}

@Schema({ timestamps: true })
export class Exam {
  @Prop({ required: true })
  title: string;

  @Prop({ type: String, enum: ExamScope, required: true })
  scope: ExamScope;

  @Prop({ type: Types.ObjectId, ref: 'Lesson' })
  lessonId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'CourseModule', required: true, index: true })
  moduleId: Types.ObjectId;

  @Prop({ required: true, default: 70, min: 0, max: 100 })
  minScorePercent: number;

  @Prop({ required: true, default: 1, min: 1 })
  maxAttempts: number;

  @Prop({ default: false })
  allowRetake: boolean;

  @Prop({ default: false })
  showCorrectAnswers: boolean;

  @Prop({ default: true })
  immediateResult: boolean;

  @Prop({ default: false })
  published: boolean;
}

export const ExamSchema = SchemaFactory.createForClass(Exam);
