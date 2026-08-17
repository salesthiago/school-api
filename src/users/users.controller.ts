import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { UsersService } from './users.service';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
}
