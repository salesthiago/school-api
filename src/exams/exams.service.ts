import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Exam, ExamDocument, ExamScope } from './schemas/exam.schema';
import { Question, QuestionDocument } from './schemas/question.schema';
import { ExamAttempt, ExamAttemptDocument } from './schemas/exam-attempt.schema';
import { CourseModule, CourseModuleDocument } from '../modules/schemas/module.schema';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import { Lesson, LessonDocument } from '../lessons/schemas/lesson.schema';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';
import { JwtUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { idFilter } from '../common/utils/mongo-id.util';

@Injectable()
export class ExamsService {
  constructor(
    @InjectModel(Exam.name) private examModel: Model<ExamDocument>,
    @InjectModel(Question.name) private questionModel: Model<QuestionDocument>,
    @InjectModel(ExamAttempt.name) private attemptModel: Model<ExamAttemptDocument>,
    @InjectModel(CourseModule.name) private moduleModel: Model<CourseModuleDocument>,
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
    @InjectModel(Lesson.name) private lessonModel: Model<LessonDocument>,
  ) {}

  async createExam(dto: CreateExamDto, user: JwtUser) {
    let courseId: string;
    let moduleId: string | undefined;
    let lessonId: string | undefined;

    if (dto.scope === ExamScope.MODULE) {
      if (!dto.moduleId) throw new BadRequestException('moduleId é obrigatório para prova de módulo');
      const module = await this.moduleModel.findById(dto.moduleId);
      if (!module) throw new NotFoundException('Módulo não encontrado');
      moduleId = dto.moduleId;
      courseId = module.courseId.toString();
    } else if (dto.scope === ExamScope.LESSON) {
      if (!dto.lessonId) throw new BadRequestException('lessonId é obrigatório para prova de aula');
      const lesson = await this.lessonModel.findById(dto.lessonId);
      if (!lesson) throw new NotFoundException('Aula não encontrada');
      lessonId = dto.lessonId;
      moduleId = lesson.moduleId?.toString();
      courseId = lesson.courseId.toString();
    } else {
      if (!dto.courseId) throw new BadRequestException('courseId é obrigatório para prova do curso');
      courseId = dto.courseId;
    }

    await this.assertOwnership(courseId, user);
    await this.assertNoDuplicateTarget(dto.scope, { courseId, moduleId, lessonId });

    return this.examModel.create({
      title: dto.title,
      scope: dto.scope,
      lessonId: lessonId ? new Types.ObjectId(lessonId) : undefined,
      moduleId: moduleId ? new Types.ObjectId(moduleId) : undefined,
      courseId: new Types.ObjectId(courseId),
      minScorePercent: dto.minScorePercent,
      maxAttempts: dto.maxAttempts,
      allowRetake: dto.allowRetake,
      showCorrectAnswers: dto.showCorrectAnswers,
      immediateResult: dto.immediateResult,
    });
  }

  async updateExam(id: string, dto: UpdateExamDto, user: JwtUser) {
    const exam = await this.findExamById(id);
    await this.assertOwnership(exam.courseId.toString(), user);
    Object.assign(exam, dto);
    await exam.save();
    return exam;
  }

  async deleteExam(id: string, user: JwtUser) {
    const exam = await this.findExamById(id);
    await this.assertOwnership(exam.courseId.toString(), user);
    await this.questionModel.deleteMany({ examId: id });
    await exam.deleteOne();
  }

  async findExamById(id: string): Promise<ExamDocument> {
    const exam = await this.examModel.findById(id);
    if (!exam) throw new NotFoundException('Avaliação não encontrada');
    return exam;
  }

  findByModule(moduleId: string) {
    return this.examModel.find({ ...idFilter('$moduleId', moduleId), scope: ExamScope.MODULE });
  }

  findByLesson(lessonId: string) {
    return this.examModel.find({ ...idFilter('$lessonId', lessonId), scope: ExamScope.LESSON });
  }

  findByCourseScope(courseId: string) {
    return this.examModel.find({ ...idFilter('$courseId', courseId), scope: ExamScope.COURSE });
  }

  async addQuestion(examId: string, dto: CreateQuestionDto, user: JwtUser) {
    const exam = await this.findExamById(examId);
    await this.assertOwnership(exam.courseId.toString(), user);
    return this.questionModel.create({ ...dto, examId });
  }

  async updateQuestion(id: string, dto: UpdateQuestionDto, user: JwtUser) {
    const question = await this.findQuestionById(id);
    const exam = await this.findExamById(question.examId.toString());
    await this.assertOwnership(exam.courseId.toString(), user);
    Object.assign(question, dto);
    await question.save();
    return question;
  }

  async deleteQuestion(id: string, user: JwtUser) {
    const question = await this.findQuestionById(id);
    const exam = await this.findExamById(question.examId.toString());
    await this.assertOwnership(exam.courseId.toString(), user);
    await question.deleteOne();
  }

  private async findQuestionById(id: string): Promise<QuestionDocument> {
    const question = await this.questionModel.findById(id);
    if (!question) throw new NotFoundException('Questão não encontrada');
    return question;
  }

  async getExamForManage(examId: string, user: JwtUser) {
    const exam = await this.findExamById(examId);
    await this.assertOwnership(exam.courseId.toString(), user);
    const questions = await this.questionModel.find({ examId }).sort({ order: 1 });
    return { exam, questions };
  }

  async getQuestionsForStudent(examId: string) {
    const questions = await this.questionModel.find({ examId }).sort({ order: 1 });
    return questions.map((q) => ({
      id: q.id,
      text: q.text,
      type: q.type,
      options: q.options.map((o, idx) => ({ index: idx, text: o.text })),
    }));
  }

  async submitAttempt(examId: string, studentId: string, dto: SubmitAttemptDto) {
    const exam = await this.findExamById(examId);
    const previousAttempts = await this.attemptModel.countDocuments({ examId, studentId });

    if (previousAttempts >= exam.maxAttempts && !exam.allowRetake) {
      throw new BadRequestException('Número máximo de tentativas atingido');
    }

    const questions = await this.questionModel.find({ examId });
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    let correctCount = 0;
    const answers = dto.answers.map((a) => {
      const question = questionMap.get(a.questionId);
      if (!question) throw new BadRequestException('Questão inválida');
      const correctIndexes = question.options
        .map((o, idx) => (o.correct ? idx : -1))
        .filter((idx) => idx !== -1)
        .sort();
      const selected = [...a.selectedOptionIndexes].sort();
      const isCorrect =
        correctIndexes.length === selected.length &&
        correctIndexes.every((v, i) => v === selected[i]);
      if (isCorrect) correctCount += 1;
      return {
        questionId: a.questionId,
        selectedOptionIndexes: a.selectedOptionIndexes,
        correct: isCorrect,
      };
    });

    const scorePercent = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;
    const passed = scorePercent >= exam.minScorePercent;

    const attempt = await this.attemptModel.create({
      examId,
      studentId,
      attemptNumber: previousAttempts + 1,
      answers,
      scorePercent,
      passed,
      submittedAt: new Date(),
    });

    return {
      attemptId: attempt.id,
      scorePercent,
      passed,
      minScorePercent: exam.minScorePercent,
      scope: exam.scope,
      moduleId: exam.moduleId?.toString(),
      courseId: exam.courseId.toString(),
      correctAnswers: exam.showCorrectAnswers
        ? questions.map((q) => ({
            questionId: q.id,
            correctOptionIndexes: q.options
              .map((o, idx) => (o.correct ? idx : -1))
              .filter((idx) => idx !== -1),
          }))
        : undefined,
    };
  }

  async hasPassed(examId: string, studentId: string): Promise<boolean> {
    const attempt = await this.attemptModel.findOne({ examId, studentId, passed: true });
    return !!attempt;
  }

  async getFinalExamStatus(moduleId: string, studentId: string) {
    const exam = await this.examModel.findOne({ ...idFilter('$moduleId', moduleId), scope: ExamScope.MODULE });
    if (!exam) return { exists: false, passed: true };
    const passed = await this.hasPassed(exam.id, studentId);
    return { exists: true, examId: exam.id, passed };
  }

  async getFinalExamStatusForCourse(courseId: string, studentId: string) {
    const exam = await this.examModel.findOne({ ...idFilter('$courseId', courseId), scope: ExamScope.COURSE });
    if (!exam) return { exists: false, passed: true };
    const passed = await this.hasPassed(exam.id, studentId);
    return { exists: true, examId: exam.id, passed };
  }

  private async assertNoDuplicateTarget(
    scope: ExamScope,
    target: { courseId: string; moduleId?: string; lessonId?: string },
  ) {
    let existing: ExamDocument | null = null;
    if (scope === ExamScope.MODULE) {
      existing = await this.examModel.findOne({ ...idFilter('$moduleId', target.moduleId!), scope });
    } else if (scope === ExamScope.LESSON) {
      existing = await this.examModel.findOne({ ...idFilter('$lessonId', target.lessonId!), scope });
    } else {
      existing = await this.examModel.findOne({ ...idFilter('$courseId', target.courseId), scope });
    }
    if (existing) throw new BadRequestException('Já existe uma prova para este item');
  }

  private async assertOwnership(courseId: string, user: JwtUser) {
    if (user.role === Role.ADMIN) return;
    const course = await this.courseModel.findById(courseId);
    if (!course) throw new NotFoundException('Curso não encontrado');
    if (course.teacherId.toString() !== user.userId) {
      throw new ForbiddenException('Você não tem acesso a este curso');
    }
  }
}
