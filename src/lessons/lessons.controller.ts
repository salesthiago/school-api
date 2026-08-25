import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { CompleteVideoUploadDto } from './dto/complete-video-upload.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { EnrollmentsService } from '../enrollments/enrollments.service';

@Controller('lessons')
@UseGuards(JwtAuthGuard)
export class LessonsController {
  constructor(
    private readonly lessonsService: LessonsService,
    private readonly enrollmentsService: EnrollmentsService,
  ) {}

  /**
   * `moduleId` → aulas de um módulo (matrícula igual sempre foi).
   * `courseId` → TODAS as aulas do curso (soltas + de módulo), só pra quem gerencia o curso —
   * usado pela tela de estrutura do curso, não é uma listagem de navegação do aluno.
   */
  @Get()
  async find(
    @Query('moduleId') moduleId: string | undefined,
    @Query('courseId') courseId: string | undefined,
    @CurrentUser() user: JwtUser,
  ) {
    if (moduleId) {
      const access = await this.lessonsService.resolveModuleAccessKey(moduleId);
      await this.assertCanView(access, user);
      return this.lessonsService.findByModule(moduleId);
    }
    if (courseId) {
      if (user.role === Role.STUDENT) {
        throw new ForbiddenException('Endpoint reservado a professores/administradores');
      }
      return this.lessonsService.findByCourse(courseId);
    }
    throw new BadRequestException('Informe moduleId ou courseId');
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    const access = await this.lessonsService.getAccessKey(id);
    await this.assertCanView(access, user);
    return this.lessonsService.findById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  create(@Body() dto: CreateLessonDto, @CurrentUser() user: JwtUser) {
    return this.lessonsService.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateLessonDto, @CurrentUser() user: JwtUser) {
    return this.lessonsService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.lessonsService.remove(id, user);
  }

  @Post(':id/video/init')
  @UseGuards(RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  initVideoUpload(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.lessonsService.initVideoUpload(id, user);
  }

  @Post(':id/video/complete')
  @UseGuards(RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  completeVideoUpload(
    @Param('id') id: string,
    @Body() dto: CompleteVideoUploadDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.lessonsService.completeVideoUpload(id, dto, user);
  }

  @Delete(':id/video')
  @UseGuards(RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  removeVideo(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.lessonsService.removeVideo(id, user);
  }

  /**
   * Vídeo/anexos de aula só ficam visíveis para quem está matriculado (no módulo, ou na trilha
   * de aulas avulsas do curso quando a aula não tem módulo) — professor/admin sempre podem
   * pré-visualizar o próprio conteúdo.
   */
  private async assertCanView(access: { courseId: string; moduleId?: string }, user: JwtUser) {
    if (user.role !== Role.STUDENT) return;
    const canAccess = await this.enrollmentsService.canAccess(user.userId, access.courseId, access.moduleId);
    if (!canAccess) {
      throw new ForbiddenException(
        access.moduleId
          ? 'Você precisa se matricular neste módulo para ver o conteúdo'
          : 'Você precisa se matricular neste curso para ver o conteúdo',
      );
    }
  }
}
