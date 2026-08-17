import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { ManualEnrollDto } from './dto/manual-enroll.dto';
import { ModulesService } from '../modules/modules.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';

@Controller('enrollments')
@UseGuards(JwtAuthGuard)
export class EnrollmentsController {
  constructor(
    private readonly enrollmentsService: EnrollmentsService,
    private readonly modulesService: ModulesService,
  ) {}

  @Get('mine')
  findMine(@CurrentUser() user: JwtUser) {
    return this.enrollmentsService.findByStudent(user.userId);
  }

  @Post('manual')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async manualEnroll(@Body() dto: ManualEnrollDto, @CurrentUser() user: JwtUser) {
    const courseModule = await this.modulesService.findById(dto.moduleId);
    return this.enrollmentsService.grantManually(
      dto.studentId,
      dto.moduleId,
      courseModule.courseId.toString(),
      user.userId,
    );
  }
}
