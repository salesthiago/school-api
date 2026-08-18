import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserAdminDto } from './dto/update-user-admin.dto';

const ANY_ROLE = [Role.STUDENT, Role.TEACHER, Role.ADMIN];

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @Roles(...ANY_ROLE)
  getProfile(@CurrentUser() user: JwtUser) {
    return this.usersService.getProfile(user.userId);
  }

  @Patch('me')
  @Roles(...ANY_ROLE)
  updateProfile(@CurrentUser() user: JwtUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.userId, dto);
  }

  @Post('me/avatar')
  @Roles(...ANY_ROLE)
  @UseInterceptors(FileInterceptor('file'))
  uploadAvatar(@CurrentUser() user: JwtUser, @UploadedFile() file: Express.Multer.File) {
    return this.usersService.setAvatar(user.userId, file);
  }

  @Get()
  findAll(@Query('role') role?: Role) {
    return this.usersService.findAll(role ? { role } : {});
  }

  /**
   * Único caminho para criar contas de professor/admin: o papel vem de um
   * DTO validado (não do /auth/register público) e a rota é admin-only,
   * evitando escalonamento de privilégio via campo `role` livre.
   */
  @Post()
  create(@Body() dto: CreateStaffUserDto) {
    return this.usersService.create(dto, dto.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.getProfile(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserAdminDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.usersService.softDelete(id, user.userId);
  }
}
