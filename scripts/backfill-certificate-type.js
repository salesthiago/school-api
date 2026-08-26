/**
 * Migração: preenche `certificate.type` (novo campo) — 'module' quando moduleId está setado,
 * 'track' quando não está (não existe 'full' ainda, cobertura é total). Também troca o índice
 * único antigo `{studentId, moduleId, courseId}` pelo novo `{studentId, courseId, type, moduleId}`
 * — o antigo precisa ser removido explicitamente, senão continua bloqueando um certificado
 * 'track' e um 'full' coexistirem pro mesmo aluno/curso (ambos com moduleId: null).
 * Idempotente: pula certificados que já têm type; recria o índice mesmo se já rodado antes.
 *
 * Uso: node scripts/backfill-certificate-type.js [--dry-run] [mongodb-uri]
 * Sem mongodb-uri, usa MONGODB_URI do .env (ou mongodb://localhost:27017/gpschool).
 */
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const uriArg = process.argv.find((a) => a.startsWith('mongodb'));
  const uri = uriArg || process.env.MONGODB_URI || 'mongodb://localhost:27017/gpschool';

  console.log(`Conectando em ${uri}${dryRun ? ' (dry-run — nenhuma escrita será feita)' : ''}`);
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const collection = db.collection('certificates');

  const certificates = await collection.find({ type: { $exists: false } }).toArray();
  console.log(`${certificates.length} certificado(s) sem type encontrados.`);

  let updated = 0;
  for (const cert of certificates) {
    const type = cert.moduleId ? 'module' : 'track';
    if (!dryRun) {
      await collection.updateOne({ _id: cert._id }, { $set: { type } });
    }
    updated++;
  }
  console.log(`${updated} certificado(s) ${dryRun ? 'seriam atualizados' : 'atualizados'}.`);

  if (!dryRun) {
    const indexes = await collection.indexes();
    const oldIndex = indexes.find(
      (idx) => idx.key && idx.key.studentId === 1 && idx.key.moduleId === 1 && idx.key.courseId === 1 && !('type' in idx.key),
    );
    if (oldIndex) {
      console.log(`Removendo índice antigo ${oldIndex.name}...`);
      await collection.dropIndex(oldIndex.name);
    }
    console.log('Criando índice novo {studentId, courseId, type, moduleId} (unique)...');
    await collection.createIndex({ studentId: 1, courseId: 1, type: 1, moduleId: 1 }, { unique: true });
  } else {
    console.log('(dry-run) índice antigo seria removido e o novo criado.');
  }

  console.log('\nConcluído.');
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
