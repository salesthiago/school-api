import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Enrollment,
  EnrollmentDocument,
  EnrollmentSource,
  EnrollmentStatus,
} from './schemas/enrollment.schema';

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectModel(Enrollment.name) private enrollmentModel: Model<EnrollmentDocument>,
  ) {}

  /** moduleId ausente = acesso à trilha de aulas avulsas do curso, não a um módulo específico. */
  async canAccess(studentId: string, courseId: string, moduleId?: string): Promise<boolean> {
    const enrollment = await this.enrollmentModel.findOne({
      studentId,
      courseId,
      moduleId: moduleId ?? null,
      status: EnrollmentStatus.ACTIVE,
    });
    return !!enrollment;
  }

  async activateFromPayment(
    studentId: string,
    courseId: string,
    orderId: string,
    moduleId?: string,
  ) {
    return this.enrollmentModel.findOneAndUpdate(
      { studentId, courseId, moduleId: moduleId ?? null },
      {
        studentId,
        courseId,
        moduleId: moduleId ?? null,
        orderId,
        source: EnrollmentSource.PAYMENT,
        status: EnrollmentStatus.ACTIVE,
      },
      { upsert: true, new: true },
    );
  }

  async enrollFree(studentId: string, courseId: string, moduleId?: string) {
    return this.enrollmentModel.findOneAndUpdate(
      { studentId, courseId, moduleId: moduleId ?? null },
      {
        studentId,
        courseId,
        moduleId: moduleId ?? null,
        source: EnrollmentSource.FREE,
        status: EnrollmentStatus.ACTIVE,
      },
      { upsert: true, new: true },
    );
  }

  async grantManually(
    studentId: string,
    courseId: string,
    grantedByUserId: string,
    moduleId?: string,
  ) {
    return this.enrollmentModel.findOneAndUpdate(
      { studentId, courseId, moduleId: moduleId ?? null },
      {
        studentId,
        courseId,
        moduleId: moduleId ?? null,
        grantedByUserId,
        source: EnrollmentSource.MANUAL,
        status: EnrollmentStatus.ACTIVE,
      },
      { upsert: true, new: true },
    );
  }

  async revoke(studentId: string, courseId: string, moduleId?: string) {
    await this.enrollmentModel.findOneAndUpdate(
      { studentId, courseId, moduleId: moduleId ?? null },
      { status: EnrollmentStatus.REVOKED },
    );
  }

  findByStudent(studentId: string) {
    return this.enrollmentModel
      .find({ studentId, status: EnrollmentStatus.ACTIVE })
      .populate('moduleId')
      .populate('courseId');
  }
}
