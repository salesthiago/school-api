import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Exam, ExamDocument, ExamScope } from './schemas/exam.schema';
import { Question, QuestionDocument } from './schemas/question.schema';
import { ExamAttempt, ExamAttemptDocument } from './schemas/exam-attempt.schema';
import { CreateExamDto } from './dto/create-exam.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';

@Injectable()
export class ExamsService {
  constructor(
    @InjectModel(Exam.name) private examModel: Model<ExamDocument>,
    @InjectModel(Question.name) private questionModel: Model<QuestionDocument>,
    @InjectModel(ExamAttempt.name) private attemptModel: Model<ExamAttemptDocument>,
  ) {}

  createExam(dto: CreateExamDto) {
    return this.examModel.create(dto);
  }

  async findExamById(id: string): Promise<ExamDocument> {
    const exam = await this.examModel.findById(id);
    if (!exam) throw new NotFoundException('Avaliação não encontrada');
    return exam;
  }

  findByModule(moduleId: string) {
    return this.examModel.find({ moduleId });
  }

  addQuestion(examId: string, dto: CreateQuestionDto) {
    return this.questionModel.create({ ...dto, examId });
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
    const exam = await this.examModel.findOne({ moduleId, scope: ExamScope.MODULE });
    if (!exam) return { exists: false, passed: true };
    const passed = await this.hasPassed(exam.id, studentId);
    return { exists: true, examId: exam.id, passed };
  }
}
