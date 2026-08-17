import { Controller, ForbiddenException, Get, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { LocalStorageProvider } from './local-storage.provider';

@Controller('storage/files')
export class StorageController {
  constructor(private readonly provider: LocalStorageProvider) {}

  @Get(':key')
  stream(
    @Param('key') key: string,
    @Query('expires') expires: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const decodedKey = decodeURIComponent(key);
    const valid = this.provider.verify(decodedKey, Number(expires), token);
    if (!valid) {
      throw new ForbiddenException('Link expirado ou inválido');
    }
    this.provider.readStream(decodedKey).pipe(res);
  }
}
