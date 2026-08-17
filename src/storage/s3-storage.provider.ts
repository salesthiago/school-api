import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageProvider, UploadResult } from './storage-provider.interface';

@Injectable()
export class S3StorageProvider implements StorageProvider {
  private client?: S3Client;

  constructor(private readonly config: ConfigService) {}

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<UploadResult> {
    await this.getClient().send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: mimeType }),
    );
    return { storageKey: key, sizeBytes: buffer.length };
  }

  getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.getClient(), command, { expiresIn: expiresInSeconds });
  }

  async delete(key: string): Promise<void> {
    await this.getClient().send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  private get bucket(): string {
    return this.config.get<string>('AWS_S3_BUCKET') ?? '';
  }

  /**
   * Client criado sob demanda (não no construtor): esse provider é sempre
   * instanciado pelo StorageModule mesmo quando STORAGE_DRIVER=local, e o
   * S3Client valida a região já no construtor — instanciar cedo quebraria o
   * dev que nunca configura AWS_*.
   */
  private getClient(): S3Client {
    if (!this.client) {
      const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
      const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');
      this.client = new S3Client({
        region: this.config.get<string>('AWS_REGION'),
        // Sem credenciais explícitas, o SDK cai para o provider chain padrão
        // (variáveis AWS_* do ambiente, IAM role da instância, etc).
        ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
      });
    }
    return this.client;
  }
}
