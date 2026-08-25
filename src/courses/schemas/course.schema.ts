import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CourseDocument = HydratedDocument<Course>;

@Schema({ timestamps: true })
export class Course {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop()
  description?: string;

  @Prop()
  coverImageKey?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  teacherId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Institution', required: true, index: true })
  institutionId: Types.ObjectId;

  @Prop({ default: false })
  published: boolean;

  @Prop({ default: false })
  sellAsBundle: boolean;

  /** Preço da trilha de aulas avulsas do curso (aulas sem módulo). */
  @Prop()
  bundlePrice?: number;

  /** Trilha de aulas avulsas gratuita — ver `bundlePrice`. */
  @Prop({ default: false })
  free: boolean;

  /** % mínimo assistido pra considerar uma aula avulsa concluída — espelha CourseModule. */
  @Prop({ default: 90, min: 1, max: 100 })
  completionThresholdPercent: number;
}

export const CourseSchema = SchemaFactory.createForClass(Course);
