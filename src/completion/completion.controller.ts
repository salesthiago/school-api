import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CompletionService } from './completion.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';

@Controller('completion')
@UseGuards(JwtAuthGuard)
export class CompletionController {
  constructor(private readonly completionService: CompletionService) {}

  @Get('module/:moduleId')
  checkModule(@Param('moduleId') moduleId: string, @CurrentUser() user: JwtUser) {
    return this.completionService.checkModule(user.userId, moduleId);
  }

  @Get('course/:courseId')
  checkCourseTrack(@Param('courseId') courseId: string, @CurrentUser() user: JwtUser) {
    return this.completionService.checkCourseTrack(user.userId, courseId);
  }

  @Get('course/:courseId/full')
  checkCourseFull(@Param('courseId') courseId: string, @CurrentUser() user: JwtUser) {
    return this.completionService.checkCourseFull(user.userId, courseId);
  }
}
