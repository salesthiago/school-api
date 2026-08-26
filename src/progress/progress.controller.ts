import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';

@Controller('progress')
@UseGuards(JwtAuthGuard)
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Post()
  upsert(@Body() dto: UpdateProgressDto, @CurrentUser() user: JwtUser) {
    return this.progressService.upsert(user.userId, dto);
  }

  @Get('lesson/:lessonId')
  getLessonProgress(@Param('lessonId') lessonId: string, @CurrentUser() user: JwtUser) {
    return this.progressService.getLessonProgress(user.userId, lessonId);
  }

  @Get('module/:moduleId')
  getModuleSummary(@Param('moduleId') moduleId: string, @CurrentUser() user: JwtUser) {
    return this.progressService.getModuleSummary(user.userId, moduleId);
  }

  @Get('course/:courseId')
  getCourseTrackSummary(@Param('courseId') courseId: string, @CurrentUser() user: JwtUser) {
    return this.progressService.getCourseTrackSummary(user.userId, courseId);
  }
}
