import mongoose from 'mongoose';

/**
 * Precisa ser importado antes de qualquer schema (@Schema/SchemaFactory) para
 * que o default seja aplicado na compilação dos schemas. Sem isso, respostas
 * JSON trazem apenas `_id` (ObjectId), e não o virtual `id` (string) que o
 * restante da API e o frontend usam.
 */
mongoose.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
