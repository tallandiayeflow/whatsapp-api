import { Injectable, NotFoundException, ConflictException, UnauthorizedException, OnModuleInit } from '@nestjs/common';
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
  private readonly resetTokens = new Map<string, { email: string; expiresAt: number }>();

  constructor(
    @InjectRepository(User, 'main')
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.userRepository.count();
    if (count > 0) return;

    const password = process.env.NODE_ENV === 'production' ? randomBytes(12).toString('hex') : 'admin';

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = this.userRepository.create({
      email: 'admin@localhost',
      passwordHash,
      role: ApiKeyRole.ADMIN,
    });
    await this.userRepository.save(user);

    if (process.env.NODE_ENV === 'production') {
      try {
        writeFileSync(ADMIN_PASSWORD_FILE, password, { encoding: 'utf-8', mode: 0o600 });
      } catch (err) {
        this.logger.warn('Could not save admin password file', { error: String(err) });
      }
    }

    this.logger.log(`Default admin user created — email: admin@localhost, password: ${password}`);
  }

  async create(dto: CreateUserDto): Promise<User> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException(`User with email '${email}' already exists`);
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = this.userRepository.create({
      email,
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
    const normalizedEmail = dto.email !== undefined ? dto.email.toLowerCase().trim() : undefined;
    if (normalizedEmail !== undefined && normalizedEmail !== user.email) {
      const existing = await this.userRepository.findOne({ where: { email: normalizedEmail } });
      if (existing) {
        throw new ConflictException(`User with email '${normalizedEmail}' already exists`);
      }
    }
    if (normalizedEmail !== undefined) user.email = normalizedEmail;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    return this.userRepository.save(user);
  }

  async delete(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepository.remove(user);
  }

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.userRepository.findOne({ where: { email: dto.email.toLowerCase().trim() } });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const token = await this.jwtService.signAsync(payload);
    const raw: unknown = this.jwtService.decode(token);
    const decoded = raw !== null && typeof raw === 'object' ? (raw as { exp?: number; iat?: number }) : null;
    const expiresIn = decoded?.exp && decoded?.iat ? decoded.exp - decoded.iat : 86400;

    this.logger.log(`User login: ${user.email}`, { userId: user.id, action: 'user_login' });

    return {
      access_token: token,
      token_type: 'Bearer',
      expires_in: expiresIn,
      role: user.role,
      email: user.email,
    };
  }

  async requestPasswordReset(email: string): Promise<string> {
    const user = await this.userRepository.findOne({ where: { email: email.toLowerCase().trim() } });
    const token = randomBytes(3).toString('hex');
    if (user) {
      this.resetTokens.set(token, { email: user.email.toLowerCase(), expiresAt: Date.now() + 15 * 60 * 1000 });
      this.logger.log('Password reset token generated', { email, token, action: 'password_reset_request' });
    }
    return token;
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const entry = this.resetTokens.get(token);
    if (!entry || entry.expiresAt < Date.now()) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }
    const user = await this.userRepository.findOne({ where: { email: entry.email } });
    if (!user) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }
    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.userRepository.save(user);
    this.resetTokens.delete(token);
    this.logger.log('Password reset completed', { email: entry.email, action: 'password_reset' });
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
