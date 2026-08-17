export interface UploadResult {
  storageKey: string;
  sizeBytes: number;
}

export interface StorageProvider {
  upload(key: string, buffer: Buffer, mimeType: string): Promise<UploadResult>;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
}

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
