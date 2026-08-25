/**
 * Migração: troca o índice único {studentId, moduleId} por {studentId, moduleId, courseId}
 * em `enrollments` e `certificates`. Necessário porque matrículas/certificados na trilha de
 * aulas avulsas do curso têm moduleId nulo, e o índice antigo (2 campos) bloquearia um mesmo
 * aluno de ter matrícula "sem módulo" em mais de um curso (moduleId:null colide entre cursos
 * diferentes sob o índice antigo). Rodar uma vez, antes/durante o deploy desta mudança.
 *
 * Idempotente: se o índice antigo já não existir, só confirma que o novo existe.
 *
 * Uso: node scripts/rebuild-enrollment-certificate-indexes.js [mongodb-uri]
 */
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function rebuild(db, collectionName) {
  const collection = db.collection(collectionName);
  const indexes = await collection.indexes();
  const oldIndex = indexes.find(
    (i) => JSON.stringify(Object.keys(i.key)) === JSON.stringify(['studentId', 'moduleId']),
  );

  if (oldIndex) {
    console.log(`[${collectionName}] removendo índice antigo "${oldIndex.name}"...`);
    await collection.dropIndex(oldIndex.name);
  } else {
    console.log(`[${collectionName}] índice antigo {studentId, moduleId} não encontrado (ok, já migrado).`);
  }

  console.log(`[${collectionName}] garantindo índice novo {studentId, moduleId, courseId}...`);
  await collection.createIndex({ studentId: 1, moduleId: 1, courseId: 1 }, { unique: true });
  console.log(`[${collectionName}] ok.`);
}

async function main() {
  const uriArg = process.argv.find((a) => a.startsWith('mongodb'));
  const uri = uriArg || process.env.MONGODB_URI || 'mongodb://localhost:27017/gpschool';

  console.log(`Conectando em ${uri}`);
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  await rebuild(db, 'enrollments');
  await rebuild(db, 'certificates');

  await client.close();
  console.log('\nConcluído.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
