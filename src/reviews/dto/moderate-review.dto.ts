import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReviewStatus } from '../schemas/review.schema';

export class ModerateReviewDto {
  @IsIn([ReviewStatus.APPROVED, ReviewStatus.REJECTED])
  status: ReviewStatus.APPROVED | ReviewStatus.REJECTED;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}
