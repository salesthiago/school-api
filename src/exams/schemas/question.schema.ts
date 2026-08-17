import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type QuestionDocument = HydratedDocument<Question>;

export enum QuestionType {
  SINGLE = 'single',
  MULTIPLE = 'multiple',
}

@Schema({ _id: false })
export class QuestionOption {
  @Prop({ required: true })
  text: string;

  @Prop({ required: true, default: false })
  correct: boolean;
}
export const QuestionOptionSchema = SchemaFactory.createForClass(QuestionOption);

@Schema({ timestamps: true })
export class Question {
  @Prop({ type: Types.ObjectId, ref: 'Exam', required: true, index: true })
  examId: Types.ObjectId;

  @Prop({ required: true })
  text: string;

  @Prop({ type: String, enum: QuestionType, required: true, default: QuestionType.SINGLE })
  type: QuestionType;

  @Prop({ type: [QuestionOptionSchema], required: true })
  options: QuestionOption[];

  @Prop({ required: true, default: 0 })
  order: number;
}

export const QuestionSchema = SchemaFactory.createForClass(Question);
