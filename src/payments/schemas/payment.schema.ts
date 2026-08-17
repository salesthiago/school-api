import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PaymentDocument = HydratedDocument<Payment>;

export enum PaymentStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  EXPIRED = 'expired',
  CANCELED = 'canceled',
}

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, index: true })
  orderId: Types.ObjectId;

  @Prop({ required: true })
  provider: string;

  @Prop({ required: true, unique: true, index: true })
  providerReference: string;

  @Prop({ type: String, enum: PaymentStatus, default: PaymentStatus.PENDING, index: true })
  status: PaymentStatus;

  @Prop({ type: Object })
  instructions?: Record<string, unknown>;

  @Prop({ type: Object })
  webhookPayload?: Record<string, unknown>;

  @Prop()
  confirmedAt?: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
