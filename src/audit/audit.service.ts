import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

@Injectable()
export class AuditService {
  constructor(@InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>) {}

  log(action: string, params: { actorUserId?: string; targetType?: string; targetId?: string; metadata?: Record<string, unknown> } = {}) {
    return this.auditLogModel.create({ action, ...params });
  }

  findAll(filter: Partial<{ action: string; targetType: string }> = {}) {
    return this.auditLogModel.find(filter).sort({ createdAt: -1 }).limit(500);
  }
}
