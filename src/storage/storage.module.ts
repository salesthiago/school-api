import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalStorageProvider } from './local-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';
import { StorageController } from './storage.controller';
import { STORAGE_PROVIDER } from './storage-provider.interface';

@Module({
  controllers: [StorageController],
  providers: [
    LocalStorageProvider,
    S3StorageProvider,
    {
      provide: STORAGE_PROVIDER,
      useFactory: (config: ConfigService, local: LocalStorageProvider, s3: S3StorageProvider) =>
        config.get<string>('STORAGE_DRIVER') === 's3' ? s3 : local,
      inject: [ConfigService, LocalStorageProvider, S3StorageProvider],
    },
  ],
  exports: [STORAGE_PROVIDER, LocalStorageProvider],
})
export class StorageModule {}
