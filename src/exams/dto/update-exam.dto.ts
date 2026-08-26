import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateExamDto } from './create-exam.dto';

/**
 * Só os campos de configuração são editáveis — scope/lessonId/moduleId/courseId são fixos após a
 * criação. Precisa ser PartialType (não uma classe própria com campos soltos) — uma classe comum
 * com campos `x?: T` é compilada com semântica `useDefineForClassFields` (tsconfig target ES2023),
 * o que faz toda instância nascer com essas chaves como `undefined` já definidas; um
 * `Object.assign(doc, dto)` então sobrescreve campos não enviados com `undefined` e quebra a
 * validação do Mongoose no save. PartialType() não tem esse problema (mesmo padrão já usado em
 * UpdateModuleDto/UpdateLessonDto/UpdateCourseDto).
 */
export class UpdateExamDto extends PartialType(
  OmitType(CreateExamDto, ['scope', 'lessonId', 'moduleId', 'courseId'] as const),
) {}
