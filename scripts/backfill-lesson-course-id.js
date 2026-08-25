/**
 * Migração: preenche `lesson.courseId` (novo campo) a partir de `lesson.moduleId → module.courseId`
 * para toda aula já existente. Não altera nada além disso — moduleId permanece intocado.
 * Idempotente: pula aulas que já têm courseId.
 *
 * Uso: node scripts/backfill-lesson-course-id.js [--dry-run] [mongodb-uri]
 * Sem mongodb-uri, usa MONGODB_URI do .env (ou mongodb://localhost:27017/gpschool).
 */
require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const uriArg = process.argv.find((a) => a.startsWith('mongodb'));
  const uri = uriArg || process.env.MONGODB_URI || 'mongodb://localhost:27017/gpschool';

  console.log(`Conectando em ${uri}${dryRun ? ' (dry-run — nenhuma escrita será feita)' : ''}`);
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const lessons = await db
    .collection('lessons')
    .find({ courseId: { $exists: false } })
    .toArray();

  console.log(`${lessons.length} aula(s) sem courseId encontradas.`);

  let updated = 0;
  let orphaned = 0;

  for (const lesson of lessons) {
    if (!lesson.moduleId) {
      console.warn(`  AVISO: aula ${lesson._id} não tem moduleId nem courseId — pulando (verificar manualmente).`);
      orphaned++;
      continue;
    }

    const module = await db.collection('modules').findOne({ _id: new ObjectId(lesson.moduleId) });
    if (!module) {
      console.warn(`  AVISO: aula ${lesson._id} referencia módulo inexistente ${lesson.moduleId} — pulando.`);
      orphaned++;
      continue;
    }

    if (!dryRun) {
      await db
        .collection('lessons')
        .updateOne({ _id: lesson._id }, { $set: { courseId: module.courseId } });
    }
    updated++;
  }

  console.log(`\nConcluído. ${updated} aula(s) ${dryRun ? 'seriam atualizadas' : 'atualizadas'}, ${orphaned} órfã(s) (sem módulo válido, precisam de correção manual).`);

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
