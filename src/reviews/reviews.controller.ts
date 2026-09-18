import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ModerateReviewDto } from './dto/moderate-review.dto';
import { ReviewStatus } from './schemas/review.schema';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import {
  CurrentUser,
  JwtUser,
} from '../common/decorators/current-user.decorator';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('courses/:courseId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  upsert(
    @Param('courseId') courseId: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.reviewsService.upsert(user.userId, courseId, dto);
  }

  @Get('courses/:courseId/mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  findMine(@Param('courseId') courseId: string, @CurrentUser() user: JwtUser) {
    return this.reviewsService.findMine(user.userId, courseId);
  }

  /** Nota média + avaliações aprovadas — vitrine pública, sem autenticação. */
  @Get('courses/:courseId')
  findPublic(@Param('courseId') courseId: string) {
    return this.reviewsService.getPublicOverview(courseId);
  }

  @Get('courses/:courseId/moderation')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  findForModeration(
    @Param('courseId') courseId: string,
    @Query('status') status: ReviewStatus | undefined,
    @CurrentUser() user: JwtUser,
  ) {
    return this.reviewsService.findForModeration(courseId, user, status);
  }

  @Patch(':id/moderate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  moderate(
    @Param('id') id: string,
    @Body() dto: ModerateReviewDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.reviewsService.moderate(id, dto, user);
  }
}
