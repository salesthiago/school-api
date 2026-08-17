import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CertificatesService } from './certificates.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';

@Controller('certificates')
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Get('validate/:code')
  validate(@Param('code') code: string) {
    return this.certificatesService.validate(code);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  findMine(@CurrentUser() user: JwtUser) {
    return this.certificatesService.findByStudent(user.userId);
  }

  @Get(':id/download')
  @UseGuards(JwtAuthGuard)
  async getDownloadUrl(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    const url = await this.certificatesService.getDownloadUrl(id, user.userId);
    return { url };
  }
}
