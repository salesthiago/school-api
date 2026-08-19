import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import { CourseModule as CourseModuleEntity, CourseModuleDocument } from '../modules/schemas/module.schema';
import { Enrollment, EnrollmentDocument, EnrollmentStatus } from '../enrollments/schemas/enrollment.schema';
import { Role } from '../common/enums/role.enum';

export interface DailyCount {
  date: string;
  count: number;
}

const STATS_WINDOW_DAYS = 14;

@Injectable()
export class StatsService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
    @InjectModel(CourseModuleEntity.name) private moduleModel: Model<CourseModuleDocument>,
    @InjectModel(Enrollment.name) private enrollmentModel: Model<EnrollmentDocument>,
  ) {}

  async adminOverview() {
    const [totalStudents, totalTeachers, totalUsers, totalCourses, totalEnrollments, newUsersByDay, enrollmentsByDay] =
      await Promise.all([
        this.userModel.countDocuments({ role: Role.STUDENT }),
        this.userModel.countDocuments({ role: Role.TEACHER }),
        this.userModel.countDocuments({}),
        this.courseModel.countDocuments({}),
        this.enrollmentModel.countDocuments({ status: EnrollmentStatus.ACTIVE }),
        this.countByDay(this.userModel),
        this.countByDay(this.enrollmentModel, { status: EnrollmentStatus.ACTIVE }),
      ]);

    return {
      totalUsers,
      totalStudents,
      totalTeachers,
      totalCourses,
      totalEnrollments,
      newUsersByDay,
      enrollmentsByDay,
    };
  }

  async teacherOverview(teacherId: string) {
    const courses = await this.courseModel.find({ teacherId }).select('_id');
    // courseId/moduleId são gravados como string neste projeto, não ObjectId
    // de fato — usar string aqui para os $in baterem com o que está persistido.
    const courseIds = courses.map((c) => c._id.toString());
    const modules = await this.moduleModel.find({ courseId: { $in: courseIds } }).select('_id');
    const moduleIds = modules.map((m) => m._id.toString());

    const [totalStudents, totalEnrollments, enrollmentsByDay] = await Promise.all([
      this.enrollmentModel
        .distinct('studentId', { moduleId: { $in: moduleIds }, status: EnrollmentStatus.ACTIVE })
        .then((ids) => ids.length),
      this.enrollmentModel.countDocuments({
        moduleId: { $in: moduleIds },
        status: EnrollmentStatus.ACTIVE,
      }),
      this.countByDay(this.enrollmentModel, {
        moduleId: { $in: moduleIds },
        status: EnrollmentStatus.ACTIVE,
      }),
    ]);

    return {
      totalCourses: courses.length,
      totalModules: modules.length,
      totalStudents,
      totalEnrollments,
      enrollmentsByDay,
    };
  }

  private async countByDay(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: Model<any>,
    extraMatch: Record<string, unknown> = {},
  ): Promise<DailyCount[]> {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (STATS_WINDOW_DAYS - 1));

    const match: Record<string, unknown> = { createdAt: { $gte: since }, ...extraMatch };

    const rows = await model.aggregate<{ _id: string; count: number }>([
      { $match: match },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    ]);
    const countByDate = new Map(rows.map((r) => [r._id, r.count]));

    const series: DailyCount[] = [];
    for (let i = 0; i < STATS_WINDOW_DAYS; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      series.push({ date: key, count: countByDate.get(key) ?? 0 });
    }
    return series;
  }
}
