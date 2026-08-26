import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CertificateDocument = HydratedDocument<Certificate>;

export type CertificateType = 'module' | 'track' | 'full';

@Schema({ timestamps: true })
export class Certificate {
  @Prop({ required: true, unique: true, index: true })
  code: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  studentId: Types.ObjectId;

  /**
   * 'module' = conclusão de um módulo específico (moduleId setado).
   * 'track' = conclusão só da trilha de aulas avulsas do curso (sem módulo).
   * 'full' = conclusão do curso inteiro (todos os módulos + trilha), com prova final única.
   * 'track' e 'full' nunca têm moduleId — o campo type é o que os desambigua.
   */
  @Prop({ type: String, enum: ['module', 'track', 'full'], required: true })
  type: CertificateType;

  /** Ausente quando o certificado é da trilha de aulas avulsas ou do curso inteiro (ver type). */
  @Prop({ type: Types.ObjectId, ref: 'CourseModule', required: false })
  moduleId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Course', required: true })
  courseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Institution', required: true })
  institutionId: Types.ObjectId;

  @Prop({ required: true })
  studentName: string;

  @Prop({ required: true })
  moduleTitle: string;

  @Prop({ required: true })
  teacherName: string;

  @Prop({ required: true, default: 0 })
  workloadHours: number;

  @Prop({ required: true })
  storageKey: string;

  @Prop({ required: true, default: () => new Date() })
  issuedAt: Date;
}

export const CertificateSchema = SchemaFactory.createForClass(Certificate);
CertificateSchema.index({ studentId: 1, courseId: 1, type: 1, moduleId: 1 }, { unique: true });
