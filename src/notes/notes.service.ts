import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Note, NoteDocument } from './schemas/note.schema';

@Injectable()
export class NotesService {
  constructor(@InjectModel(Note.name) private noteModel: Model<NoteDocument>) {}

  async getMine(studentId: string, lessonId: string): Promise<{ text: string }> {
    const note = await this.noteModel.findOne({ studentId, lessonId });
    return { text: note?.text ?? '' };
  }

  async upsert(studentId: string, lessonId: string, text: string): Promise<{ text: string }> {
    await this.noteModel.findOneAndUpdate(
      { studentId, lessonId },
      { studentId, lessonId, text },
      { upsert: true },
    );
    return { text };
  }
}
