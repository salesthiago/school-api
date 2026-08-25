/**
 * courseId/moduleId (e outros refs) têm documentos gravados como string OU como ObjectId de
 * verdade, dependendo do caminho de escrita — @nestjs/mongoose@11 + mongoose@9 compila
 * `@Prop({ type: Types.ObjectId, ref: ... })` para Mixed (bug de biblioteca confirmado), então
 * o Mongoose não faz cast automático nem na escrita nem na leitura. Comparar sempre via
 * $toString dos dois lados evita que uma busca por id perca documentos gravados no formato
 * "errado" — não dá pra assumir qual formato um documento específico tem.
 */
export function idEq(fieldPath: string, value: string) {
  return { $eq: [{ $toString: fieldPath }, value] };
}

/** Filtro pronto pra usar em find()/countDocuments(): { $expr: idEq(...) }. */
export function idFilter(fieldPath: string, value: string) {
  return { $expr: idEq(fieldPath, value) };
}
