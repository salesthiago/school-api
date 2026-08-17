import { IsEnum } from 'class-validator';
import { CreateUserDto } from './create-user.dto';
import { Role } from '../../common/enums/role.enum';

export class CreateStaffUserDto extends CreateUserDto {
  @IsEnum(Role)
  role: Role;
}
