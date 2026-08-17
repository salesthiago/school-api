import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { StorageProvider, UploadResult } from './storage-provider.interface';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly uploadDir: string;
  private readonly signingSecret: string;
  private readonly publicBaseUrl: string;

  constructor(private config: ConfigService) {
    this.uploadDir = this.config.get<string>('UPLOAD_DIR') ?? path.join(process.cwd(), 'uploads');
    this.signingSecret = this.config.get<string>('STORAGE_SIGNING_SECRET') ?? 'dev-storage-secret';
    this.publicBaseUrl = this.config.get<string>('API_PUBLIC_URL') ?? 'http://localhost:3000/api';
    fs.mkdirSync(this.uploadDir, { recursive: true });
  }

  async upload(key: string, buffer: Buffer, _mimeType: string): Promise<UploadResult> {
    const filePath = path.join(this.uploadDir, key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, buffer);
    return { storageKey: key, sizeBytes: buffer.length };
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    const expires = Date.now() + expiresInSeconds * 1000;
    const token = this.sign(key, expires);
    return `${this.publicBaseUrl}/storage/files/${encodeURIComponent(key)}?expires=${expires}&token=${token}`;
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.uploadDir, key);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  verify(key: string, expires: number, token: string): boolean {
    if (Date.now() > expires) return false;
    return this.sign(key, expires) === token;
  }

  readStream(key: string) {
    return fs.createReadStream(path.join(this.uploadDir, key));
  }

  private sign(key: string, expires: number): string {
    return crypto
      .createHmac('sha256', this.signingSecret)
      .update(`${key}:${expires}`)
      .digest('hex');
  }
}
