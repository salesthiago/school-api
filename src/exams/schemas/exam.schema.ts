import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ExamDocument = HydratedDocument<Exam>;

export enum ExamScope {
  LESSON = 'lesson',
  MODULE = 'module',
  COURSE = 'course',
}

@Schema({ timestamps: true })
export class Exam {
  @Prop({ required: true })
  title: string;

  @Prop({ type: String, enum: ExamScope, required: true })
  scope: ExamScope;

  @Prop({ type: Types.ObjectId, ref: 'Lesson' })
  lessonId?: Types.ObjectId;

  /** Ausente quando a prova é da aula avulsa (sem módulo) ou do curso inteiro (scope COURSE). */
  @Prop({ type: Types.ObjectId, ref: 'CourseModule', index: true })
  moduleId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  courseId: Types.ObjectId;

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
