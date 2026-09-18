import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReviewDocument = HydratedDocument<Review>;

export enum ReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/** Avaliação (nota + comentário) de um aluno sobre um curso — precisa de aprovação pra ficar pública. */
@Schema({ timestamps: true })
export class Review {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  studentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  courseId: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ maxlength: 1000 })
  comment?: string;

  @Prop({
    type: String,
    enum: ReviewStatus,
    default: ReviewStatus.PENDING,
    index: true,
  })
  status: ReviewStatus;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  moderatedByUserId?: Types.ObjectId;

  @Prop({ type: Date })
  moderatedAt?: Date;

  @Prop({ maxlength: 500 })
  rejectionReason?: string;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);
/** Uma avaliação por aluno por curso — reenviar edita a mesma e volta pra pending. */
ReviewSchema.index({ studentId: 1, courseId: 1 }, { unique: true });
