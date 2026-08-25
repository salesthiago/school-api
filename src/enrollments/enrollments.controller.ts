import { BadRequestException, Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { ManualEnrollDto } from './dto/manual-enroll.dto';
import { EnrollDto } from './dto/enroll.dto';
import { ModulesService } from '../modules/modules.service';
import { CoursesService } from '../courses/courses.service';
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
    private readonly coursesService: CoursesService,
  ) {}

  @Get('mine')
  findMine(@CurrentUser() user: JwtUser) {
    return this.enrollmentsService.findByStudent(user.userId);
  }

  /**
   * Auto-matrícula: só funciona para módulo/trilha gratuitos. Pagos passam pelo
   * checkout (/payments/checkout), que ativa a matrícula via webhook quando o
   * pagamento é confirmado.
   */
  @Post('enroll')
  @UseGuards(RolesGuard)
  @Roles(Role.STUDENT)
  async enroll(@Body() dto: EnrollDto, @CurrentUser() user: JwtUser) {
    if (dto.moduleId) {
      const courseModule = await this.modulesService.findById(dto.moduleId);
      if (!courseModule.free && courseModule.price > 0) {
        throw new BadRequestException('Este módulo é pago; utilize o checkout para se matricular');
      }
      return this.enrollmentsService.enrollFree(
        user.userId,
        courseModule.courseId.toString(),
        dto.moduleId,
      );
    }

    if (!dto.courseId) {
      throw new BadRequestException('Informe moduleId ou courseId');
    }
    const course = await this.coursesService.findById(dto.courseId);
    if (!course.free && (course.bundlePrice ?? 0) > 0) {
      throw new BadRequestException('Este curso é pago; utilize o checkout para se matricular');
    }
    return this.enrollmentsService.enrollFree(user.userId, dto.courseId);
  }

  @Post('manual')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async manualEnroll(@Body() dto: ManualEnrollDto, @CurrentUser() user: JwtUser) {
    if (dto.moduleId) {
      const courseModule = await this.modulesService.findById(dto.moduleId);
      return this.enrollmentsService.grantManually(
        dto.studentId,
        courseModule.courseId.toString(),
        user.userId,
        dto.moduleId,
      );
    }

    if (!dto.courseId) {
      throw new BadRequestException('Informe moduleId ou courseId');
    }
    return this.enrollmentsService.grantManually(dto.studentId, dto.courseId, user.userId);
  }
}
