import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Institution, InstitutionSchema } from './schemas/institution.schema';
import { InstitutionsService } from './institutions.service';
import { InstitutionsController } from './institutions.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Institution.name, schema: InstitutionSchema }]),
    StorageModule,
  ],
  controllers: [InstitutionsController],
  providers: [InstitutionsService],
  exports: [InstitutionsService],
})
export class InstitutionsModule {}
