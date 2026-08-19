import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AttachmentsService } from './attachments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { LessonsService } from '../lessons/lessons.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';

@Controller('attachments')
@UseGuards(JwtAuthGuard)
export class AttachmentsController {
  constructor(
    private readonly attachmentsService: AttachmentsService,
    private readonly lessonsService: LessonsService,
    private readonly enrollmentsService: EnrollmentsService,
  ) {}

  @Get()
  async findByLesson(@Query('lessonId') lessonId: string, @CurrentUser() user: JwtUser) {
    if (user.role === Role.STUDENT) {
      const moduleId = await this.lessonsService.resolveModuleId(lessonId);
      const canAccess = await this.enrollmentsService.canAccess(user.userId, moduleId);
      if (!canAccess) {
        throw new ForbiddenException('Você precisa se matricular neste módulo para ver o conteúdo');
      }
    }
    return this.attachmentsService.findByLesson(lessonId);
  }

  @Post('lessons/:lessonId')
  @UseGuards(RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  upload(@Param('lessonId') lessonId: string, @UploadedFile() file: Express.Multer.File) {
    return this.attachmentsService.upload(lessonId, file);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.attachmentsService.remove(id);
  }
}
