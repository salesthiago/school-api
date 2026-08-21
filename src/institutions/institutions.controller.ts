import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InstitutionsService } from './institutions.service';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}

  @Get('public')
  getPublic() {
    return this.institutionsService.getPublic();
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateInstitutionDto) {
    return this.institutionsService.update(id, dto);
  }

  @Post(':id/logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  uploadLogo(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.institutionsService.uploadLogo(id, file);
  }

  @Post(':id/login-background')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  uploadLoginBackground(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.institutionsService.uploadLoginBackground(id, file);
  }

  @Post(':id/register-background')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  uploadRegisterBackground(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.institutionsService.uploadRegisterBackground(id, file);
  }

  @Post(':id/student-banner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  uploadStudentBanner(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.institutionsService.uploadStudentBanner(id, file);
  }
}
