import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { User, UserDocument } from './schemas/user.schema';
import { Enrollment, EnrollmentDocument, EnrollmentStatus } from '../enrollments/schemas/enrollment.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserAdminDto } from './dto/update-user-admin.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Role } from '../common/enums/role.enum';
import { STORAGE_PROVIDER, StorageProvider } from '../storage/storage-provider.interface';

const AVATAR_URL_TTL_SECONDS = 60 * 60;

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Enrollment.name) private enrollmentModel: Model<EnrollmentDocument>,
    @Inject(STORAGE_PROVIDER) private storage: StorageProvider,
  ) {}

  async create(dto: CreateUserDto, role: Role = Role.STUDENT): Promise<UserDocument> {
    const existing = await this.userModel.findOne({ email: dto.email.toLowerCase() });
    if (existing) {
      throw new ConflictException('E-mail já cadastrado');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = new this.userModel({
      name: dto.name,
      email: dto.email.toLowerCase(),
      phone: dto.phone,
      passwordHash,
      role,
    });
    return user.save();
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase(), deletedAt: null });
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async findAll(filter: Partial<{ role: Role; institutionId: string }> = {}) {
    const users = await this.userModel
      .find({ ...filter, deletedAt: null })
      .select('-passwordHash -refreshTokenHash');

    if (filter.role !== Role.STUDENT) {
      return users;
    }

    const studentIds = users.map((u) => u._id);
    const enrolledIds = new Set(
      (
        await this.enrollmentModel.distinct('studentId', {
          studentId: { $in: studentIds },
          status: EnrollmentStatus.ACTIVE,
        })
      ).map((id) => id.toString()),
    );
    return users.map((u) => ({ ...u.toJSON(), hasEnrollments: enrolledIds.has(u.id) }));
  }

  async update(id: string, dto: UpdateUserAdminDto) {
    const user = await this.findById(id);
    if (dto.email && dto.email.toLowerCase() !== user.email) {
      const existing = await this.userModel.findOne({ email: dto.email.toLowerCase() });
      if (existing) throw new ConflictException('E-mail já cadastrado');
      user.email = dto.email.toLowerCase();
    }
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.active !== undefined) user.active = dto.active;
    await user.save();
    return this.toProfile(user);
  }

  async resetPassword(id: string, dto: ResetPasswordDto) {
    const user = await this.findById(id);
    user.passwordHash = await bcrypt.hash(dto.password, 10);
    user.refreshTokenHash = undefined;
    await user.save();
  }

  async softDelete(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new ForbiddenException('Você não pode excluir a própria conta');
    }
    const user = await this.findById(id);
    user.deletedAt = new Date();
    user.refreshTokenHash = undefined;
    await user.save();
  }

  async setRefreshTokenHash(userId: string, refreshTokenHash: string | null) {
    await this.userModel.findByIdAndUpdate(userId, { refreshTokenHash });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.findById(userId);
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.instagram !== undefined || dto.twitter !== undefined) {
      user.socialLinks = {
        instagram: dto.instagram ?? user.socialLinks?.instagram,
        twitter: dto.twitter ?? user.socialLinks?.twitter,
      };
    }
    await user.save();
    return this.toProfile(user);
  }

  async setAvatar(userId: string, file: { buffer: Buffer; mimetype: string; originalname: string }) {
    const user = await this.findById(userId);
    const previousKey = user.avatarKey;
    const key = `avatars/${userId}/${randomUUID()}-${file.originalname}`;
    const { storageKey } = await this.storage.upload(key, file.buffer, file.mimetype);
    user.avatarKey = storageKey;
    await user.save();
    if (previousKey) {
      await this.storage.delete(previousKey);
    }
    return this.toProfile(user);
  }

  async getProfile(userId: string) {
    const user = await this.findById(userId);
    return this.toProfile(user);
  }

  private async toProfile(user: UserDocument) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      institutionId: user.institutionId,
      active: user.active,
      socialLinks: user.socialLinks,
      avatarUrl: user.avatarKey
        ? await this.storage.getSignedUrl(user.avatarKey, AVATAR_URL_TTL_SECONDS)
        : undefined,
    };
  }
}
