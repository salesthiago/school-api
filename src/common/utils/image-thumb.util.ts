import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

/** Largura da miniatura de capa: cobre cards de lista em telas 3x sem pesar (~20–40 KB em WebP). */
const COVER_THUMB_WIDTH = 480;
const COVER_THUMB_QUALITY = 75;

/**
 * Gera a miniatura de uma capa (WebP, largura máx. 480px, sem ampliar imagens menores).
 * `rotate()` aplica a orientação EXIF antes de descartar os metadados — fotos de celular ficam de pé.
 */
export async function makeCoverThumb(image: Buffer): Promise<Buffer> {
  try {
    return await sharp(image)
      .rotate()
      .resize({ width: COVER_THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: COVER_THUMB_QUALITY })
      .toBuffer();
  } catch {
    throw new BadRequestException('O arquivo enviado não é uma imagem válida');
  }
}
