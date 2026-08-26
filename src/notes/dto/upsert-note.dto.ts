import { IsString, MaxLength } from 'class-validator';

export class UpsertNoteDto {
  @IsString()
  @MaxLength(20000)
  text: string;
}
