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

  async canAccess(studentId: string, moduleId: string): Promise<boolean> {
    const enrollment = await this.enrollmentModel.findOne({
      studentId,
      moduleId,
      status: EnrollmentStatus.ACTIVE,
    });
    return !!enrollment;
  }

  async activateFromPayment(
    studentId: string,
    moduleId: string,
    courseId: string,
    orderId: string,
  ) {
    return this.enrollmentModel.findOneAndUpdate(
      { studentId, moduleId },
      {
        studentId,
        moduleId,
        courseId,
        orderId,
        source: EnrollmentSource.PAYMENT,
        status: EnrollmentStatus.ACTIVE,
      },
      { upsert: true, new: true },
    );
  }

  async enrollFree(studentId: string, moduleId: string, courseId: string) {
    return this.enrollmentModel.findOneAndUpdate(
      { studentId, moduleId },
      {
        studentId,
        moduleId,
        courseId,
        source: EnrollmentSource.FREE,
        status: EnrollmentStatus.ACTIVE,
      },
      { upsert: true, new: true },
    );
  }

  async grantManually(
    studentId: string,
    moduleId: string,
    courseId: string,
    grantedByUserId: string,
  ) {
    return this.enrollmentModel.findOneAndUpdate(
      { studentId, moduleId },
      {
        studentId,
        moduleId,
        courseId,
        grantedByUserId,
        source: EnrollmentSource.MANUAL,
        status: EnrollmentStatus.ACTIVE,
      },
      { upsert: true, new: true },
    );
  }

  async revoke(studentId: string, moduleId: string) {
    await this.enrollmentModel.findOneAndUpdate(
      { studentId, moduleId },
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
