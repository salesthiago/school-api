import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
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
  findByModule(@Query('moduleId') moduleId: string) {
    return this.examsService.findByModule(moduleId);
  }

  @Get(':id/questions')
  getQuestions(@Param('id') id: string) {
    return this.examsService.getQuestionsForStudent(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  create(@Body() dto: CreateExamDto) {
    return this.examsService.createExam(dto);
  }

  @Post(':id/questions')
  @UseGuards(RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  addQuestion(@Param('id') id: string, @Body() dto: CreateQuestionDto) {
    return this.examsService.addQuestion(id, dto);
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
