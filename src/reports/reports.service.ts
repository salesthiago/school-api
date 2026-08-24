import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import { Lesson, LessonDocument } from '../lessons/schemas/lesson.schema';
import { LessonProgress, LessonProgressDocument } from '../progress/schemas/lesson-progress.schema';
import { Enrollment, EnrollmentDocument, EnrollmentStatus } from '../enrollments/schemas/enrollment.schema';
import { Order, OrderDocument, OrderStatus } from '../orders/schemas/order.schema';
import { Exam, ExamDocument } from '../exams/schemas/exam.schema';
import { ExamAttempt, ExamAttemptDocument } from '../exams/schemas/exam-attempt.schema';
import { Certificate, CertificateDocument } from '../certificates/schemas/certificate.schema';
import { Role } from '../common/enums/role.enum';

export interface DailySeriesPoint {
  date: string;
  value: number;
}

const STUDENTS_WITHOUT_COURSES_LIMIT = 200;
const RANKING_LIMIT = 10;

/**
 * courseId/moduleId (e outros refs) têm documentos legados persistidos como string
 * apesar do schema declarar Types.ObjectId (ver stats.service.ts) — por isso todo
 * cruzamento aqui usa $toString dos dois lados em vez de localField/foreignField puro,
 * senão os documentos legados somem silenciosamente do relatório.
 */
function idEq(a: string, b: string) {
  return { $eq: [{ $toString: a }, { $toString: b }] };
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
    @InjectModel(Lesson.name) private lessonModel: Model<LessonDocument>,
    @InjectModel(LessonProgress.name) private lessonProgressModel: Model<LessonProgressDocument>,
    @InjectModel(Enrollment.name) private enrollmentModel: Model<EnrollmentDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Exam.name) private examModel: Model<ExamDocument>,
    @InjectModel(ExamAttempt.name) private examAttemptModel: Model<ExamAttemptDocument>,
    @InjectModel(Certificate.name) private certificateModel: Model<CertificateDocument>,
  ) {}

  async mostWatchedCourses(institutionId: string) {
    return this.lessonProgressModel.aggregate([
      {
        $lookup: {
          from: 'lessons',
          let: { lessonId: '$lessonId' },
          pipeline: [{ $match: { $expr: idEq('$_id', '$$lessonId') } }],
          as: 'lesson',
        },
      },
      { $unwind: '$lesson' },
      {
        $lookup: {
          from: 'modules',
          let: { moduleId: '$lesson.moduleId' },
          pipeline: [{ $match: { $expr: idEq('$_id', '$$moduleId') } }],
          as: 'module',
        },
      },
      { $unwind: '$module' },
      {
        $lookup: {
          from: 'courses',
          let: { courseId: '$module.courseId' },
          pipeline: [
            { $match: { $expr: idEq('$_id', '$$courseId') } },
            { $match: { $expr: idEq('$institutionId', institutionId) } },
          ],
          as: 'course',
        },
      },
      { $unwind: '$course' },
      {
        $group: {
          _id: { courseId: '$course._id', studentId: '$studentId' },
          title: { $first: '$course.title' },
          watchedSeconds: { $sum: '$watchedSeconds' },
          percentage: { $avg: '$percentage' },
        },
      },
      {
        $group: {
          _id: '$_id.courseId',
          title: { $first: '$title' },
          totalWatchedSeconds: { $sum: '$watchedSeconds' },
          avgPercentage: { $avg: '$percentage' },
          viewerCount: { $sum: 1 },
        },
      },
      { $sort: { totalWatchedSeconds: -1 } },
      { $limit: RANKING_LIMIT },
      {
        $project: {
          _id: 0,
          courseId: { $toString: '$_id' },
          title: 1,
          totalWatchedSeconds: 1,
          avgPercentage: { $round: ['$avgPercentage', 1] },
          viewerCount: 1,
        },
      },
    ]);
  }

  async registrations(institutionId: string, days: number) {
    const match = { $expr: idEq('$institutionId', institutionId) };
    const [series, totalRows] = await Promise.all([
      this.dailySeries(this.userModel, match, 'createdAt', days),
      this.userModel.aggregate<{ total: number }>([
        { $match: { role: Role.STUDENT, ...match } },
        { $count: 'total' },
      ]),
    ]);
    return { totalStudents: totalRows[0]?.total ?? 0, series };
  }

  async studentsWithoutCourses(institutionId: string) {
    return this.userModel.aggregate([
      { $match: { role: Role.STUDENT, active: true, $expr: idEq('$institutionId', institutionId) } },
      {
        $lookup: {
          from: 'enrollments',
          let: { studentId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [idEq('$studentId', '$$studentId'), { $eq: ['$status', EnrollmentStatus.ACTIVE] }],
                },
              },
            },
          ],
          as: 'activeEnrollments',
        },
      },
      { $match: { activeEnrollments: { $size: 0 } } },
      { $project: { _id: 0, id: { $toString: '$_id' }, name: 1, email: 1, createdAt: 1 } },
      { $sort: { createdAt: -1 } },
      { $limit: STUDENTS_WITHOUT_COURSES_LIMIT },
    ]);
  }

  async completionRate(institutionId: string) {
    return this.courseModel.aggregate([
      { $match: { $expr: idEq('$institutionId', institutionId) } },
      {
        $lookup: {
          from: 'enrollments',
          let: { courseId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $and: [idEq('$courseId', '$$courseId'), { $eq: ['$status', EnrollmentStatus.ACTIVE] }] },
              },
            },
            { $group: { _id: '$studentId' } },
          ],
          as: 'enrolledStudents',
        },
      },
      {
        $lookup: {
          from: 'certificates',
          let: { courseId: '$_id' },
          pipeline: [
            { $match: { $expr: idEq('$courseId', '$$courseId') } },
            { $group: { _id: '$studentId' } },
          ],
          as: 'completedStudents',
        },
      },
      {
        $project: {
          _id: 0,
          courseId: { $toString: '$_id' },
          title: 1,
          enrolledCount: { $size: '$enrolledStudents' },
          completedCount: { $size: '$completedStudents' },
          completionRatePercent: {
            $cond: [
              { $gt: [{ $size: '$enrolledStudents' }, 0] },
              {
                $round: [
                  { $multiply: [{ $divide: [{ $size: '$completedStudents' }, { $size: '$enrolledStudents' }] }, 100] },
                  1,
                ],
              },
              0,
            ],
          },
        },
      },
      { $sort: { completionRatePercent: -1 } },
    ]);
  }

  async revenue(institutionId: string, days: number) {
    const since = this.sinceDate(days);
    const [byCourse, byDayRows] = await Promise.all([
      this.orderModel.aggregate([
        { $match: { status: OrderStatus.PAID } },
        {
          $lookup: {
            from: 'courses',
            let: { courseId: '$courseId' },
            pipeline: [
              { $match: { $expr: idEq('$_id', '$$courseId') } },
              { $match: { $expr: idEq('$institutionId', institutionId) } },
            ],
            as: 'course',
          },
        },
        { $unwind: '$course' },
        {
          $group: {
            _id: '$course._id',
            title: { $first: '$course.title' },
            total: { $sum: '$amount' },
            orders: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
        { $limit: RANKING_LIMIT },
        { $project: { _id: 0, courseId: { $toString: '$_id' }, title: 1, total: 1, orders: 1 } },
      ]),
      this.orderModel.aggregate<{ _id: string; value: number }>([
        { $match: { status: OrderStatus.PAID, paidAt: { $gte: since } } },
        {
          $lookup: {
            from: 'courses',
            let: { courseId: '$courseId' },
            pipeline: [
              { $match: { $expr: idEq('$_id', '$$courseId') } },
              { $match: { $expr: idEq('$institutionId', institutionId) } },
            ],
            as: 'course',
          },
        },
        { $match: { course: { $ne: [] } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt' } },
            value: { $sum: '$amount' },
          },
        },
      ]),
    ]);

    return { byCourse, series: this.fillSeries(byDayRows, since, days) };
  }

  async examPerformance(institutionId: string) {
    return this.examAttemptModel.aggregate([
      {
        $lookup: {
          from: 'exams',
          let: { examId: '$examId' },
          pipeline: [{ $match: { $expr: idEq('$_id', '$$examId') } }],
          as: 'exam',
        },
      },
      { $unwind: '$exam' },
      {
        $lookup: {
          from: 'modules',
          let: { moduleId: '$exam.moduleId' },
          pipeline: [{ $match: { $expr: idEq('$_id', '$$moduleId') } }],
          as: 'module',
        },
      },
      { $unwind: '$module' },
      {
        $lookup: {
          from: 'courses',
          let: { courseId: '$module.courseId' },
          pipeline: [
            { $match: { $expr: idEq('$_id', '$$courseId') } },
            { $match: { $expr: idEq('$institutionId', institutionId) } },
          ],
          as: 'course',
        },
      },
      { $unwind: '$course' },
      {
        $group: {
          _id: '$exam._id',
          examTitle: { $first: '$exam.title' },
          courseTitle: { $first: '$course.title' },
          attempts: { $sum: 1 },
          passedCount: { $sum: { $cond: ['$passed', 1, 0] } },
          avgScore: { $avg: '$scorePercent' },
        },
      },
      {
        $project: {
          _id: 0,
          examId: { $toString: '$_id' },
          examTitle: 1,
          courseTitle: 1,
          attempts: 1,
          passRatePercent: { $round: [{ $multiply: [{ $divide: ['$passedCount', '$attempts'] }, 100] }, 1] },
          avgScore: { $round: ['$avgScore', 1] },
        },
      },
      { $sort: { attempts: -1 } },
      { $limit: 20 },
    ]);
  }

  async certificatesIssued(institutionId: string, days: number) {
    const since = this.sinceDate(days);
    const institutionMatch = { $expr: idEq('$institutionId', institutionId) };

    const [byDayRows, byCourse] = await Promise.all([
      this.certificateModel.aggregate<{ _id: string; value: number }>([
        { $match: { ...institutionMatch, issuedAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$issuedAt' } }, value: { $sum: 1 } } },
      ]),
      this.certificateModel.aggregate([
        { $match: institutionMatch },
        { $group: { _id: '$courseId', count: { $sum: 1 } } },
        {
          $lookup: {
            from: 'courses',
            let: { courseId: '$_id' },
            pipeline: [{ $match: { $expr: idEq('$_id', '$$courseId') } }],
            as: 'course',
          },
        },
        { $unwind: '$course' },
        { $project: { _id: 0, courseId: { $toString: '$_id' }, title: '$course.title', count: 1 } },
        { $sort: { count: -1 } },
        { $limit: RANKING_LIMIT },
      ]),
    ]);

    return { byCourse, series: this.fillSeries(byDayRows, since, days) };
  }

  private sinceDate(days: number): Date {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));
    return since;
  }

  private fillSeries(rows: { _id: string; value: number }[], since: Date, days: number): DailySeriesPoint[] {
    const byDate = new Map(rows.map((r) => [r._id, r.value]));
    const series: DailySeriesPoint[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      series.push({ date: key, value: byDate.get(key) ?? 0 });
    }
    return series;
  }

  private async dailySeries(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: Model<any>,
    match: Record<string, unknown>,
    dateField: string,
    days: number,
  ): Promise<DailySeriesPoint[]> {
    const since = this.sinceDate(days);
    const rows = await model.aggregate<{ _id: string; value: number }>([
      { $match: { ...match, [dateField]: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: `$${dateField}` } }, value: { $sum: 1 } } },
    ]);
    return this.fillSeries(rows, since, days);
  }
}
