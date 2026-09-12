import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  CurrentUser,
  JwtUser,
} from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpdatePaymentSettingsDto } from './dto/update-payment-settings.dto';
import { PaymentSettingsService } from './payment-settings.service';

@Controller('settings/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class PaymentSettingsController {
  constructor(private readonly service: PaymentSettingsService) {}

  @Get()
  get() {
    return this.service.getRedacted();
  }

  @Put()
  update(@Body() dto: UpdatePaymentSettingsDto, @CurrentUser() user: JwtUser) {
    return this.service.update(dto, user.userId);
  }

  @Post('itau/certificate')
  @UseInterceptors(FileInterceptor('file'))
  uploadItauCertificate(@UploadedFile() file: Express.Multer.File) {
    return this.service.uploadItauCertificate(file);
  }

  @Post('itau/private-key')
  @UseInterceptors(FileInterceptor('file'))
  uploadItauPrivateKey(@UploadedFile() file: Express.Multer.File) {
    return this.service.uploadItauPrivateKey(file);
  }
}
