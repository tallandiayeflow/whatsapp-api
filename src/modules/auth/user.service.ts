import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { User } from './entities/user.entity';
import { ApiKeyRole } from './entities/api-key.entity';
import { CreateUserDto, UpdateUserDto, LoginDto, LoginResponseDto, UserResponseDto } from './dto/user.dto';
import { createLogger } from '../../common/services/logger.service';

const ADMIN_PASSWORD_FILE = join(process.cwd(), 'data', '.admin-password');
const BCRYPT_ROUNDS = 12;

export interface JwtPayload {
  sub: string;
  email: string;
  role: ApiKeyRole;
}

@Injectable()
export class UserService implements OnModuleInit {
  private readonly logger = createLogger('UserService');

  constructor(
    @InjectRepository(User, 'main')
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.userRepository.count();
    if (count > 0) return;

    const password =
      process.env.NODE_ENV === 'production' ? randomBytes(12).toString('hex') : 'admin';

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = this.userRepository.create({
      email: 'admin@localhost',
      passwordHash,
      role: ApiKeyRole.ADMIN,
    });
    await this.userRepository.save(user);

    if (process.env.NODE_ENV === 'production') {
      try {
        writeFileSync(ADMIN_PASSWORD_FILE, password, 'utf-8');
      } catch (err) {
        this.logger.warn('Could not save admin password file', { error: String(err) });
      }
    }

    this.logger.log(`Default admin user created — email: admin@localhost, password: ${password}`);
  }

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.userRepository.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException(`User with email '${dto.email}' already exists`);
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = this.userRepository.create({
      email: dto.email,
      passwordHash,
      role: dto.role ?? ApiKeyRole.OPERATOR,
    });
    return this.userRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User '${id}' not found`);
    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    if (dto.email !== undefined && dto.email !== user.email) {
      const existing = await this.userRepository.findOne({ where: { email: dto.email } });
      if (existing) {
        throw new ConflictException(`User with email '${dto.email}' already exists`);
      }
    }
    if (dto.email !== undefined) user.email = dto.email;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    return this.userRepository.save(user);
  }

  async delete(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepository.remove(user);
  }

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.userRepository.findOne({ where: { email: dto.email } });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const token = await this.jwtService.signAsync(payload);

    this.logger.log(`User login: ${user.email}`, { userId: user.id, action: 'user_login' });

    return {
      access_token: token,
      token_type: 'Bearer',
      expires_in: 86400,
      role: user.role,
      email: user.email,
    };
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.findOne(userId);
    const valid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.userRepository.save(user);
  }

  toResponseDto(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
