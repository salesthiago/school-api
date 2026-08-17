import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CourseModule, CourseModuleDocument } from './schemas/module.schema';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';

@Injectable()
export class ModulesService {
  constructor(
    @InjectModel(CourseModule.name) private moduleModel: Model<CourseModuleDocument>,
  ) {}

  create(dto: CreateModuleDto) {
    return this.moduleModel.create(dto);
  }

  findByCourse(courseId: string) {
    return this.moduleModel.find({ courseId }).sort({ order: 1 });
  }

  async findById(id: string): Promise<CourseModuleDocument> {
    const module = await this.moduleModel.findById(id);
    if (!module) throw new NotFoundException('Módulo não encontrado');
    return module;
  }

  async update(id: string, dto: UpdateModuleDto) {
    const module = await this.moduleModel.findByIdAndUpdate(id, dto, { new: true });
    if (!module) throw new NotFoundException('Módulo não encontrado');
    return module;
  }

  async remove(id: string) {
    const result = await this.moduleModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException('Módulo não encontrado');
  }
}
