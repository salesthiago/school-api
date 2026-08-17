import { Module } from '@nestjs/common';
import { LocalStorageProvider } from './local-storage.provider';
import { StorageController } from './storage.controller';
import { STORAGE_PROVIDER } from './storage-provider.interface';

@Module({
  controllers: [StorageController],
  providers: [LocalStorageProvider, { provide: STORAGE_PROVIDER, useExisting: LocalStorageProvider }],
  exports: [STORAGE_PROVIDER, LocalStorageProvider],
})
export class StorageModule {}
