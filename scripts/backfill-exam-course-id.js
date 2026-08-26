/**
 * Migração: preenche `exam.courseId` (novo campo) a partir de `exam.moduleId → module.courseId`
 * para toda prova já existente (moduleId era obrigatório até agora, então toda prova tem um).
 * Não altera moduleId. Idempotente: pula provas que já têm courseId.
 *
 * Uso: node scripts/backfill-exam-course-id.js [--dry-run] [mongodb-uri]
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

  const exams = await db
    .collection('exams')
    .find({ courseId: { $exists: false } })
    .toArray();

  console.log(`${exams.length} prova(s) sem courseId encontradas.`);

  let updated = 0;
  let orphaned = 0;

  for (const exam of exams) {
    if (!exam.moduleId) {
      console.warn(`  AVISO: prova ${exam._id} não tem moduleId nem courseId — pulando (verificar manualmente).`);
      orphaned++;
      continue;
    }

    const module = await db.collection('modules').findOne({ _id: new ObjectId(exam.moduleId) });
    if (!module) {
      console.warn(`  AVISO: prova ${exam._id} referencia módulo inexistente ${exam.moduleId} — pulando.`);
      orphaned++;
      continue;
    }

    if (!dryRun) {
      await db.collection('exams').updateOne({ _id: exam._id }, { $set: { courseId: module.courseId } });
    }
    updated++;
  }

  console.log(`\nConcluído. ${updated} prova(s) ${dryRun ? 'seriam atualizadas' : 'atualizadas'}, ${orphaned} órfã(s) (sem módulo válido, precisam de correção manual).`);

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
