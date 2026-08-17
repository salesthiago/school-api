import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { Certificate, CertificateDocument } from './schemas/certificate.schema';
import { STORAGE_PROVIDER, StorageProvider } from '../storage/storage-provider.interface';
import { InstitutionsService } from '../institutions/institutions.service';

export interface GenerateCertificateParams {
  studentId: string;
  studentName: string;
  moduleId: string;
  moduleTitle: string;
  courseId: string;
  teacherName: string;
  workloadHours: number;
}

@Injectable()
export class CertificatesService {
  constructor(
    @InjectModel(Certificate.name) private certificateModel: Model<CertificateDocument>,
    @Inject(STORAGE_PROVIDER) private storage: StorageProvider,
    private institutionsService: InstitutionsService,
    private config: ConfigService,
  ) {}

  async generate(params: GenerateCertificateParams): Promise<CertificateDocument> {
    const existing = await this.certificateModel.findOne({
      studentId: params.studentId,
      moduleId: params.moduleId,
    });
    if (existing) return existing;

    const institution = await this.institutionsService.getOrCreateDefault();
    const code = `CERT-${randomUUID().split('-')[0].toUpperCase()}`;
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:4200';
    const validationUrl = `${frontendUrl}/certificates/validate/${code}`;

    const pdfBuffer = await this.buildPdf({
      ...params,
      institutionName: institution.name,
      code,
      validationUrl,
      issuedAt: new Date(),
    });

    const storageKey = `certificates/${code}.pdf`;
    await this.storage.upload(storageKey, pdfBuffer, 'application/pdf');

    return this.certificateModel.create({
      code,
      studentId: params.studentId,
      studentName: params.studentName,
      moduleId: params.moduleId,
      moduleTitle: params.moduleTitle,
      courseId: params.courseId,
      teacherName: params.teacherName,
      workloadHours: params.workloadHours,
      institutionId: institution.id,
      storageKey,
      issuedAt: new Date(),
    });
  }

  async findByStudent(studentId: string) {
    return this.certificateModel.find({ studentId }).sort({ issuedAt: -1 });
  }

  async getDownloadUrl(id: string, studentId: string) {
    const certificate = await this.certificateModel.findById(id);
    if (!certificate) throw new NotFoundException('Certificado não encontrado');
    if (certificate.studentId.toString() !== studentId) {
      throw new NotFoundException('Certificado não encontrado');
    }
    return this.storage.getSignedUrl(certificate.storageKey, 60 * 10);
  }

  async validate(code: string) {
    const certificate = await this.certificateModel.findOne({ code });
    if (!certificate) throw new NotFoundException('Certificado não encontrado');
    return {
      valid: true,
      code: certificate.code,
      studentName: certificate.studentName,
      moduleTitle: certificate.moduleTitle,
      teacherName: certificate.teacherName,
      workloadHours: certificate.workloadHours,
      issuedAt: certificate.issuedAt,
    };
  }

  private async buildPdf(params: GenerateCertificateParams & {
    institutionName: string;
    code: string;
    validationUrl: string;
    issuedAt: Date;
  }): Promise<Buffer> {
    const qrPngBuffer = await QRCode.toBuffer(params.validationUrl, { margin: 1, width: 160 });

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(10).fillColor('#666').text(params.institutionName, { align: 'center' });
      doc.moveDown(2);
      doc.fontSize(28).fillColor('#111').text('Certificado de Conclusão', { align: 'center' });
      doc.moveDown(2);
      doc
        .fontSize(14)
        .fillColor('#333')
        .text(`Certificamos que ${params.studentName} concluiu com aproveitamento o módulo`, {
          align: 'center',
        });
      doc.moveDown(0.5);
      doc.fontSize(20).fillColor('#111').text(params.moduleTitle, { align: 'center' });
      doc.moveDown(1);
      doc
        .fontSize(12)
        .fillColor('#333')
        .text(
          `Professor(a): ${params.teacherName}  •  Carga horária: ${params.workloadHours}h  •  Concluído em: ${params.issuedAt.toLocaleDateString('pt-BR')}`,
          { align: 'center' },
        );
      doc.moveDown(2);
      doc.fontSize(10).fillColor('#666').text(`Código de validação: ${params.code}`, { align: 'center' });

      doc.image(qrPngBuffer, doc.page.width / 2 - 60, doc.y + 10, { width: 120 });

      doc.end();
    });
  }
}
