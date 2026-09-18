import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Review, ReviewDocument, ReviewStatus } from './schemas/review.schema';
import { CreateReviewDto } from './dto/create-review.dto';
import { ModerateReviewDto } from './dto/moderate-review.dto';
import { CoursesService } from '../courses/courses.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { ProgressService } from '../progress/progress.service';
import { NotificationsService } from '../notifications/notifications.service';
import { JwtUser } from '../common/decorators/current-user.decorator';

const ELIGIBILITY_THRESHOLD_PERCENT = 70;

export interface ReviewEligibility {
  eligible: boolean;
  percentage: number;
  threshold: number;
}

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    private coursesService: CoursesService,
    private enrollmentsService: EnrollmentsService,
    private progressService: ProgressService,
    private notificationsService: NotificationsService,
  ) {}

  async getEligibility(
    studentId: string,
    courseId: string,
  ): Promise<ReviewEligibility> {
    const enrolled = await this.enrollmentsService.hasAnyActiveEnrollment(
      studentId,
      courseId,
    );
    if (!enrolled) {
      return { eligible: false, percentage: 0, threshold: ELIGIBILITY_THRESHOLD_PERCENT };
    }
    const { percentage } = await this.progressService.getCourseOverallProgress(
      studentId,
      courseId,
    );
    return {
      eligible: percentage >= ELIGIBILITY_THRESHOLD_PERCENT,
      percentage,
      threshold: ELIGIBILITY_THRESHOLD_PERCENT,
    };
  }

  async upsert(studentId: string, courseId: string, dto: CreateReviewDto) {
    const eligibility = await this.getEligibility(studentId, courseId);
    if (!eligibility.eligible) {
      throw new ForbiddenException(
        `Você precisa concluir pelo menos ${eligibility.threshold}% do curso para avaliá-lo (atual: ${eligibility.percentage}%)`,
      );
    }

    const course = await this.coursesService.findById(courseId);
    const review = await this.reviewModel.findOneAndUpdate(
      { studentId, courseId },
      {
        studentId,
        courseId,
        rating: dto.rating,
        comment: dto.comment,
        status: ReviewStatus.PENDING,
        moderatedByUserId: null,
        moderatedAt: null,
        rejectionReason: null,
      },
      { upsert: true, new: true },
    );

    await this.notificationsService.create(
      course.teacherId.toString(),
      'Nova avaliação para aprovar',
      `Um aluno avaliou o curso "${course.title}" e aguarda sua aprovação.`,
    );

    return review;
  }

  async findMine(studentId: string, courseId: string) {
    const [review, eligibility] = await Promise.all([
      this.reviewModel.findOne({ studentId, courseId }),
      this.getEligibility(studentId, courseId),
    ]);
    return { review, eligibility };
  }

  async findApprovedForCourse(courseId: string) {
    return this.reviewModel
      .find({ courseId, status: ReviewStatus.APPROVED })
      .populate('studentId', 'name')
      .sort({ createdAt: -1 });
  }

  async getSummary(courseId: string): Promise<{ average: number; count: number }> {
    const approved = await this.reviewModel.find({
      courseId,
      status: ReviewStatus.APPROVED,
    });
    if (approved.length === 0) return { average: 0, count: 0 };
    const total = approved.reduce((sum, r) => sum + r.rating, 0);
    return {
      average: Math.round((total / approved.length) * 10) / 10,
      count: approved.length,
    };
  }

  async getPublicOverview(courseId: string) {
    const [summary, reviews] = await Promise.all([
      this.getSummary(courseId),
      this.findApprovedForCourse(courseId),
    ]);
    return { summary, reviews };
  }

  async findForModeration(
    courseId: string,
    user: JwtUser,
    status?: ReviewStatus,
  ) {
    const course = await this.coursesService.findById(courseId);
    this.coursesService.assertOwnership(course, user);
    return this.reviewModel
      .find({ courseId, status: status ?? ReviewStatus.PENDING })
      .populate('studentId', 'name')
      .sort({ createdAt: -1 });
  }

  async moderate(reviewId: string, dto: ModerateReviewDto, user: JwtUser) {
    const review = await this.reviewModel.findById(reviewId);
    if (!review) throw new NotFoundException('Avaliação não encontrada');

    const course = await this.coursesService.findById(review.courseId.toString());
    this.coursesService.assertOwnership(course, user);

    review.status = dto.status;
    review.moderatedByUserId = user.userId as unknown as Review['moderatedByUserId'];
    review.moderatedAt = new Date();
    review.rejectionReason =
      dto.status === ReviewStatus.REJECTED ? dto.rejectionReason : undefined;
    await review.save();

    const approved = dto.status === ReviewStatus.APPROVED;
    await this.notificationsService.create(
      review.studentId.toString(),
      approved ? 'Sua avaliação foi aprovada' : 'Sua avaliação foi rejeitada',
      approved
        ? `Sua avaliação do curso "${course.title}" já está publicada.`
        : `Sua avaliação do curso "${course.title}" foi rejeitada${dto.rejectionReason ? `: ${dto.rejectionReason}` : '.'}`,
    );

    return review;
  }
}
