import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateBunnySettingsDto } from './dto/update-bunny-settings.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('bunny')
  getBunny() {
    return this.settingsService.getBunnySettings();
  }

  @Put('bunny')
  updateBunny(@Body() dto: UpdateBunnySettingsDto, @CurrentUser() user: JwtUser) {
    return this.settingsService.updateBunnySettings(dto, user.userId);
  }
}
