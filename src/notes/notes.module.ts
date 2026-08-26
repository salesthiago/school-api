import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Note, NoteSchema } from './schemas/note.schema';
import { NotesService } from './notes.service';
import { NotesController } from './notes.controller';
import { LessonsModule } from '../lessons/lessons.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Note.name, schema: NoteSchema }]),
    LessonsModule,
    EnrollmentsModule,
  ],
  controllers: [NotesController],
  providers: [NotesService],
})
export class NotesModule {}
