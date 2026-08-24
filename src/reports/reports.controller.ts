import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';

const DEFAULT_DAYS = 30;
const MIN_DAYS = 7;
const MAX_DAYS = 365;

function parseDays(raw?: string): number {
  const parsed = parseInt(raw ?? '', 10);
  if (Number.isNaN(parsed)) return DEFAULT_DAYS;
  return Math.min(MAX_DAYS, Math.max(MIN_DAYS, parsed));
}

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('most-watched-courses')
  mostWatchedCourses(@CurrentUser() user: JwtUser) {
    return this.reportsService.mostWatchedCourses(user.institutionId);
  }

  @Get('registrations')
  registrations(@CurrentUser() user: JwtUser, @Query('days') days?: string) {
    return this.reportsService.registrations(user.institutionId, parseDays(days));
  }

  @Get('students-without-courses')
  studentsWithoutCourses(@CurrentUser() user: JwtUser) {
    return this.reportsService.studentsWithoutCourses(user.institutionId);
  }

  @Get('completion-rate')
  completionRate(@CurrentUser() user: JwtUser) {
    return this.reportsService.completionRate(user.institutionId);
  }

  @Get('revenue')
  revenue(@CurrentUser() user: JwtUser, @Query('days') days?: string) {
    return this.reportsService.revenue(user.institutionId, parseDays(days));
  }

  @Get('exam-performance')
  examPerformance(@CurrentUser() user: JwtUser) {
    return this.reportsService.examPerformance(user.institutionId);
  }

  @Get('certificates-issued')
  certificatesIssued(@CurrentUser() user: JwtUser, @Query('days') days?: string) {
    return this.reportsService.certificatesIssued(user.institutionId, parseDays(days));
  }
}
