import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Institution, InstitutionDocument } from './schemas/institution.schema';
import { UpdateInstitutionDto } from './dto/update-institution.dto';

@Injectable()
export class InstitutionsService {
  constructor(
    @InjectModel(Institution.name) private institutionModel: Model<InstitutionDocument>,
  ) {}

  async findById(id: string): Promise<InstitutionDocument> {
    const institution = await this.institutionModel.findById(id);
    if (!institution) throw new NotFoundException('Instituição não encontrada');
    return institution;
  }

  async update(id: string, dto: UpdateInstitutionDto): Promise<InstitutionDocument> {
    const institution = await this.institutionModel.findByIdAndUpdate(id, dto, { new: true });
    if (!institution) throw new NotFoundException('Instituição não encontrada');
    return institution;
  }

  async getOrCreateDefault(): Promise<InstitutionDocument> {
    const existing = await this.institutionModel.findOne();
    if (existing) return existing;
    return this.institutionModel.create({ name: 'GPschool' });
  }
}
