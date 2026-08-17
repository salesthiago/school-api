import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ExamAttemptDocument = HydratedDocument<ExamAttempt>;

@Schema({ _id: false })
export class AnswerEntry {
  @Prop({ type: Types.ObjectId, ref: 'Question', required: true })
  questionId: Types.ObjectId;

  @Prop({ type: [Number], required: true })
  selectedOptionIndexes: number[];

  @Prop({ required: true, default: false })
  correct: boolean;
}
export const AnswerEntrySchema = SchemaFactory.createForClass(AnswerEntry);

@Schema({ timestamps: true, collection: 'examAttempts' })
export class ExamAttempt {
  @Prop({ type: Types.ObjectId, ref: 'Exam', required: true, index: true })
  examId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  studentId: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  attemptNumber: number;

  @Prop({ type: [AnswerEntrySchema], required: true })
  answers: AnswerEntry[];

  @Prop({ required: true, min: 0, max: 100 })
  scorePercent: number;

  @Prop({ required: true })
  passed: boolean;

  @Prop({ required: true, default: () => new Date() })
  submittedAt: Date;
}

export const ExamAttemptSchema = SchemaFactory.createForClass(ExamAttempt);
