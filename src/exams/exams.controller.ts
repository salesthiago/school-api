import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';

@Controller('exams')
@UseGuards(JwtAuthGuard)
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Get()
  find(
    @Query('moduleId') moduleId?: string,
    @Query('lessonId') lessonId?: string,
    @Query('courseId') courseId?: string,
  ) {
    if (lessonId) return this.examsService.findByLesson(lessonId);
    if (moduleId) return this.examsService.findByModule(moduleId);
    return this.examsService.findByCourseScope(courseId!);
  }

  @Get(':id/questions')
  getQuestions(@Param('id') id: string) {
    return this.examsService.getQuestionsForStudent(id);
  }

  @Get(':id/manage')
  @UseGuards(RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  getManage(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.examsService.getExamForManage(id, user);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  create(@Body() dto: CreateExamDto, @CurrentUser() user: JwtUser) {
    return this.examsService.createExam(dto, user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateExamDto, @CurrentUser() user: JwtUser) {
    return this.examsService.updateExam(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.examsService.deleteExam(id, user);
  }

  @Post(':id/questions')
  @UseGuards(RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  addQuestion(@Param('id') id: string, @Body() dto: CreateQuestionDto, @CurrentUser() user: JwtUser) {
    return this.examsService.addQuestion(id, dto, user);
  }

  @Patch('questions/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  updateQuestion(@Param('id') id: string, @Body() dto: UpdateQuestionDto, @CurrentUser() user: JwtUser) {
    return this.examsService.updateQuestion(id, dto, user);
  }

  @Delete('questions/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  deleteQuestion(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.examsService.deleteQuestion(id, user);
  }

  @Post(':id/attempts')
  @UseGuards(RolesGuard)
  @Roles(Role.STUDENT)
  submitAttempt(
    @Param('id') id: string,
    @Body() dto: SubmitAttemptDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.examsService.submitAttempt(id, user.userId, dto);
  }
}
