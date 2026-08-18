import { Controller, Get, UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';

@Controller('stats')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('admin')
  @Roles(Role.ADMIN)
  admin() {
    return this.statsService.adminOverview();
  }

  @Get('teacher')
  @Roles(Role.TEACHER, Role.ADMIN)
  teacher(@CurrentUser() user: JwtUser) {
    return this.statsService.teacherOverview(user.userId);
  }
}
