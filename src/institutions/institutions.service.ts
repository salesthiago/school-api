import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { Institution, InstitutionDocument } from './schemas/institution.schema';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { STORAGE_PROVIDER, StorageProvider } from '../storage/storage-provider.interface';

const IMAGE_URL_TTL_SECONDS = 60 * 60;

type ImageField = 'logoKey' | 'loginBackgroundKey' | 'registerBackgroundKey' | 'studentBannerKey';

@Injectable()
export class InstitutionsService {
  constructor(
    @InjectModel(Institution.name) private institutionModel: Model<InstitutionDocument>,
    @Inject(STORAGE_PROVIDER) private storage: StorageProvider,
  ) {}

  async findById(id: string): Promise<InstitutionDocument> {
    const institution = await this.institutionModel.findById(id);
    if (!institution) throw new NotFoundException('Instituição não encontrada');
    return institution;
  }

  async update(id: string, dto: UpdateInstitutionDto) {
    const institution = await this.institutionModel.findByIdAndUpdate(id, dto, { new: true });
    if (!institution) throw new NotFoundException('Instituição não encontrada');
    return this.toPublic(institution);
  }

  async getPublic() {
    return this.toPublic(await this.getOrCreateDefault());
  }

  async getOrCreateDefault(): Promise<InstitutionDocument> {
    const existing = await this.institutionModel.findOne();
    if (existing) return existing;
    return this.institutionModel.create({ name: 'GPschool' });
  }

  async uploadLogo(id: string, file: { buffer: Buffer; mimetype: string; originalname: string }) {
    return this.uploadImage(id, 'logoKey', 'logo', file);
  }

  async uploadLoginBackground(
    id: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
  ) {
    return this.uploadImage(id, 'loginBackgroundKey', 'login-background', file);
  }

  async uploadRegisterBackground(
    id: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
  ) {
    return this.uploadImage(id, 'registerBackgroundKey', 'register-background', file);
  }

  async uploadStudentBanner(
    id: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
  ) {
    return this.uploadImage(id, 'studentBannerKey', 'student-banner', file);
  }

  private async uploadImage(
    id: string,
    field: ImageField,
    prefix: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
  ) {
    const institution = await this.findById(id);
    const previousKey = institution[field];
    const key = `institutions/${id}/${prefix}/${randomUUID()}-${file.originalname}`;
    const { storageKey } = await this.storage.upload(key, file.buffer, file.mimetype);
    institution[field] = storageKey;
    await institution.save();
    if (previousKey) {
      await this.storage.delete(previousKey);
    }
    return this.toPublic(institution);
  }

  private async toPublic(institution: InstitutionDocument) {
    const { logoKey, loginBackgroundKey, registerBackgroundKey, studentBannerKey, ...json } =
      institution.toJSON() as unknown as Record<string, unknown> & {
        logoKey?: string;
        loginBackgroundKey?: string;
        registerBackgroundKey?: string;
        studentBannerKey?: string;
      };
    const [logoUrl, loginBackgroundUrl, registerBackgroundUrl, studentBannerUrl] = await Promise.all([
      logoKey ? this.storage.getSignedUrl(logoKey, IMAGE_URL_TTL_SECONDS) : undefined,
      loginBackgroundKey ? this.storage.getSignedUrl(loginBackgroundKey, IMAGE_URL_TTL_SECONDS) : undefined,
      registerBackgroundKey
        ? this.storage.getSignedUrl(registerBackgroundKey, IMAGE_URL_TTL_SECONDS)
        : undefined,
      studentBannerKey ? this.storage.getSignedUrl(studentBannerKey, IMAGE_URL_TTL_SECONDS) : undefined,
    ]);
    return { ...json, logoUrl, loginBackgroundUrl, registerBackgroundUrl, studentBannerUrl };
  }
}
