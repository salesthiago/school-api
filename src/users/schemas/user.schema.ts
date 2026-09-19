import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  })
  email: string;

  @Prop()
  phone?: string;

  @Prop({ required: true })
  passwordHash: string;

  /** Conta Google vinculada (claim `sub`) — login com Google no app. Único quando presente. */
  @Prop({ type: String, unique: true, sparse: true })
  googleId?: string;

  @Prop({ type: String, enum: Role, default: Role.STUDENT, index: true })
  role: Role;

  /** Papel real do professor enquanto ele está "vendo como aluno" — ver AuthService.switchRole. */
  @Prop({ type: String, enum: Role, default: null })
  originalRole?: Role | null;

  @Prop({ type: Types.ObjectId, ref: 'Institution', index: true })
  institutionId?: Types.ObjectId;

  @Prop({ default: true })
  active: boolean;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;

  @Prop()
  refreshTokenHash?: string;

  @Prop()
  avatarKey?: string;

  @Prop({ type: { instagram: String, twitter: String }, _id: false })
  socialLinks?: {
    instagram?: string;
    twitter?: string;
  };

  @Prop({ maxlength: 280 })
  bio?: string;

  @Prop()
  birthDate?: Date;

  @Prop({ default: true })
  emailNotifications: boolean;

  @Prop({ default: true })
  completionNotifications: boolean;

  @Prop()
  passwordChangedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
