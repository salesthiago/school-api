import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type InstitutionDocument = HydratedDocument<Institution>;

@Schema({ timestamps: true })
export class Institution {
  @Prop({ required: true })
  name: string;

  @Prop()
  logoUrl?: string;

  @Prop({ default: '#1565C0' })
  primaryColor: string;

  @Prop({ default: '#26A69A' })
  secondaryColor: string;

  @Prop()
  address?: string;

  @Prop()
  phone?: string;

  @Prop()
  email?: string;

  @Prop()
  website?: string;

  @Prop({ type: Object, default: {} })
  certificateSettings: Record<string, unknown>;
}

export const InstitutionSchema = SchemaFactory.createForClass(Institution);
