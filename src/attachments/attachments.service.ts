import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Attachment, AttachmentDocument } from './schemas/attachment.schema';
import { STORAGE_PROVIDER, StorageProvider } from '../storage/storage-provider.interface';
import { randomUUID } from 'crypto';

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectModel(Attachment.name) private attachmentModel: Model<AttachmentDocument>,
    @Inject(STORAGE_PROVIDER) private storage: StorageProvider,
  ) {}

  async upload(lessonId: string, file: { originalname: string; buffer: Buffer; mimetype: string }) {
    const key = `lessons/${lessonId}/${randomUUID()}-${file.originalname}`;
    const { storageKey, sizeBytes } = await this.storage.upload(key, file.buffer, file.mimetype);
    return this.attachmentModel.create({
      fileName: file.originalname,
      storageKey,
      mimeType: file.mimetype,
      sizeBytes,
      lessonId,
    });
  }

  async findByLesson(lessonId: string) {
    const attachments = await this.attachmentModel.find({ lessonId });
    return Promise.all(
      attachments.map(async (a) => ({
        id: a.id,
        fileName: a.fileName,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        url: await this.storage.getSignedUrl(a.storageKey, 60 * 15),
      })),
    );
  }

  async remove(id: string) {
    const attachment = await this.attachmentModel.findById(id);
    if (!attachment) throw new NotFoundException('Anexo não encontrado');
    await this.storage.delete(attachment.storageKey);
    await attachment.deleteOne();
  }
}
