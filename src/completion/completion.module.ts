import { Module } from '@nestjs/common';
import { CompletionService } from './completion.service';
import { CompletionController } from './completion.controller';
import { ProgressModule } from '../progress/progress.module';
import { ExamsModule } from '../exams/exams.module';
import { CertificatesModule } from '../certificates/certificates.module';
import { ModulesModule } from '../modules/modules.module';
import { CoursesModule } from '../courses/courses.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    ProgressModule,
    ExamsModule,
    CertificatesModule,
    ModulesModule,
    CoursesModule,
    UsersModule,
  ],
  controllers: [CompletionController],
  providers: [CompletionService],
})
export class CompletionModule {}
