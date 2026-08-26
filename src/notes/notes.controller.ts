import { Body, Controller, ForbiddenException, Get, Param, Put, UseGuards } from '@nestjs/common';
import { NotesService } from './notes.service';
import { UpsertNoteDto } from './dto/upsert-note.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { LessonsService } from '../lessons/lessons.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';

@Controller('notes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STUDENT)
export class NotesController {
  constructor(
    private readonly notesService: NotesService,
    private readonly lessonsService: LessonsService,
    private readonly enrollmentsService: EnrollmentsService,
  ) {}

  @Get('lesson/:lessonId')
  async getMine(@Param('lessonId') lessonId: string, @CurrentUser() user: JwtUser) {
    await this.assertCanView(lessonId, user);
    return this.notesService.getMine(user.userId, lessonId);
  }

  @Put('lesson/:lessonId')
  async upsert(
    @Param('lessonId') lessonId: string,
    @Body() dto: UpsertNoteDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.assertCanView(lessonId, user);
    return this.notesService.upsert(user.userId, lessonId, dto.text);
  }

  private async assertCanView(lessonId: string, user: JwtUser) {
    const access = await this.lessonsService.getAccessKey(lessonId);
    const canAccess = await this.enrollmentsService.canAccess(user.userId, access.courseId, access.moduleId);
    if (!canAccess) {
      throw new ForbiddenException('Você precisa se matricular para anotar nesta aula');
    }
  }
}
