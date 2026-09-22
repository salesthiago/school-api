import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import { AppModule } from '../../app.module';
import { Course, CourseDocument } from '../../courses/schemas/course.schema';
import {
  CourseModule,
  CourseModuleDocument,
} from '../../modules/schemas/module.schema';
import {
  STORAGE_PROVIDER,
  StorageProvider,
} from '../../storage/storage-provider.interface';
import { makeCoverThumb } from '../../common/utils/image-thumb.util';

/**
 * Gera a miniatura (coverThumbKey) das capas de curso/módulo enviadas antes de existir esse recurso.
 * Usa o mesmo storage configurado no app (local ou S3). Idempotente: pula quem já tem miniatura.
 *
 * Uso: npm run migrate:backfill-cover-thumbs [-- --dry-run]
 */
async function backfill<T extends CourseDocument | CourseModuleDocument>(
  label: string,
  dir: string,
  model: Model<T>,
  storage: StorageProvider,
  dryRun: boolean,
) {
  const docs = await model.find({
    coverImageKey: { $exists: true, $nin: [null, ''] },
    $or: [{ coverThumbKey: { $exists: false } }, { coverThumbKey: null }],
  });
  console.log(`${label}: ${docs.length} capa(s) sem miniatura.`);

  let done = 0;
  let failed = 0;
  for (const doc of docs) {
    const id = doc.id as string;
    try {
      if (!dryRun) {
        const original = await storage.download(doc.coverImageKey as string);
        const thumb = await makeCoverThumb(original);
        const { storageKey } = await storage.upload(
          `${dir}/${id}/${randomUUID()}-thumb.webp`,
          thumb,
          'image/webp',
        );
        await model.updateOne({ _id: doc._id }, { coverThumbKey: storageKey });
      }
      done++;
    } catch (err) {
      failed++;
      console.warn(`  AVISO: ${label} ${id} — ${(err as Error).message}`);
    }
  }
  console.log(`${label}: ${done} ok, ${failed} com falha.`);
}

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  try {
    const storage = app.get<StorageProvider>(STORAGE_PROVIDER);
    console.log(dryRun ? 'Modo dry-run — nada será gravado.' : 'Gerando...');
    await backfill(
      'Cursos',
      'courses',
      app.get<Model<CourseDocument>>(getModelToken(Course.name)),
      storage,
      dryRun,
    );
    await backfill(
      'Módulos',
      'modules',
      app.get<Model<CourseModuleDocument>>(getModelToken(CourseModule.name)),
      storage,
      dryRun,
    );
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
