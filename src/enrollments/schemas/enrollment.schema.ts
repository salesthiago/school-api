import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EnrollmentDocument = HydratedDocument<Enrollment>;

export enum EnrollmentSource {
  PAYMENT = 'payment',
  MANUAL = 'manual',
  FREE = 'free',
}

export enum EnrollmentStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
}

@Schema({ timestamps: true })
export class Enrollment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  studentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'CourseModule', required: true, index: true })
  moduleId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Course', required: true })
  courseId: Types.ObjectId;

  @Prop({ type: String, enum: EnrollmentStatus, default: EnrollmentStatus.ACTIVE, index: true })
  status: EnrollmentStatus;

  @Prop({ type: String, enum: EnrollmentSource, required: true })
  source: EnrollmentSource;

  @Prop({ type: Types.ObjectId, ref: 'Order' })
  orderId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  grantedByUserId?: Types.ObjectId;
}

export const EnrollmentSchema = SchemaFactory.createForClass(Enrollment);
EnrollmentSchema.index({ studentId: 1, moduleId: 1 }, { unique: true });
