import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NoteDocument = HydratedDocument<Note>;

/** Bloco de anotações pessoais do aluno numa aula — um por aluno por aula, não uma lista. */
@Schema({ timestamps: true })
export class Note {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  studentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Lesson', required: true, index: true })
  lessonId: Types.ObjectId;

  @Prop({ default: '' })
  text: string;
}

export const NoteSchema = SchemaFactory.createForClass(Note);
NoteSchema.index({ studentId: 1, lessonId: 1 }, { unique: true });
