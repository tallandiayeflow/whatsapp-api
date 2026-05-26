# Email/Password Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email/password authentication as an alternative to API key auth — users can log in with credentials and receive a JWT token usable on all existing endpoints, without breaking any existing API key functionality.

**Architecture:** A new `User` entity lives on the `main` SQLite database alongside `ApiKey`. `UserService` handles User CRUD, password hashing (bcryptjs), JWT issuance, and first-boot seeding. `ApiKeyGuard` is extended to try JWT verification for `Authorization: Bearer` tokens before falling back to the existing API key hash lookup. The dashboard `Login.tsx` gains a second tab for email/password login; `api.ts` and `App.tsx` are updated to carry JWT tokens.

**Tech Stack:** `@nestjs/jwt`, `bcryptjs`, existing TypeORM `main` SQLite connection, React (dashboard)

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `src/modules/auth/entities/user.entity.ts` | User TypeORM entity (main DB) |
| Create | `src/modules/auth/dto/user.dto.ts` | DTOs: create, update, login, response, change-password |
| Create | `src/modules/auth/user.service.ts` | User CRUD + bcrypt + JWT login + first-boot seed |
| Create | `src/modules/auth/user.service.spec.ts` | Unit tests for UserService |
| Create | `src/modules/auth/user.controller.ts` | POST /auth/login, user CRUD (ADMIN), change-password |
| Modify | `src/config/configuration.ts` | Add `jwt.secret` and `jwt.expiresIn` config keys |
| Modify | `src/modules/auth/auth.module.ts` | Import JwtModule, register User entity, add UserService/UserController |
| Modify | `src/modules/auth/guards/api-key.guard.ts` | Try JWT verify for Bearer tokens before API key hash lookup |
| Modify | `src/modules/auth/guards/api-key.guard.spec.ts` | Tests for JWT path in guard |
| Modify | `src/modules/auth/auth-validate.controller.ts` | Return role from `request.apiKey` when guard already validated JWT |
| Modify | `dashboard/src/services/api.ts` | Send `Authorization: Bearer` when `openwa_jwt` is set in sessionStorage |
| Modify | `dashboard/src/App.tsx` | Store/clear `openwa_jwt`, validate JWT token on mount/login |
| Modify | `dashboard/src/pages/Login.tsx` | Add email/password tab alongside existing API key tab |
| Modify | `dashboard/src/pages/Login.css` | Tab styles |

---

## Task 1: Install backend dependencies

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Install runtime packages**

```bash
cd c:/Dev/openwa
npm install bcryptjs @nestjs/jwt
npm install -D @types/bcryptjs
```

Expected output: packages added, no peer dependency errors.

- [ ] **Step 2: Verify imports resolve**

```bash
node -e "require('bcryptjs'); require('@nestjs/jwt'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add bcryptjs and @nestjs/jwt dependencies"
```

---

## Task 2: Add JWT configuration

**Files:**
- Modify: `src/config/configuration.ts`

- [ ] **Step 1: Add jwt section to configuration factory**

In `src/config/configuration.ts`, add this block before the closing `});`:

```typescript
  // JWT configuration (email/password auth)
  jwt: {
    secret: process.env.JWT_SECRET || 'openwa-dev-jwt-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
```

Final file should look like (last section before closing):
```typescript
  // Storage configuration
  storage: {
    type: process.env.STORAGE_TYPE || 'local',
    localPath: process.env.STORAGE_LOCAL_PATH || './data/media',
    s3: {
      bucket: process.env.S3_BUCKET,
      region: process.env.S3_REGION,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      endpoint: process.env.S3_ENDPOINT,
    },
  },

  // JWT configuration (email/password auth)
  jwt: {
    secret: process.env.JWT_SECRET || 'openwa-dev-jwt-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/config/configuration.ts
git commit -m "feat(auth): add JWT config keys (JWT_SECRET, JWT_EXPIRES_IN)"
```

---

## Task 3: Create User entity

**Files:**
- Create: `src/modules/auth/entities/user.entity.ts`

- [ ] **Step 1: Create the file**

```typescript
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ApiKeyRole } from './api-key.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 100 })
  passwordHash: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: ApiKeyRole.ADMIN,
  })
  role: ApiKeyRole;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/auth/entities/user.entity.ts
git commit -m "feat(auth): add User entity on main SQLite DB"
```

---

## Task 4: Create User DTOs

**Files:**
- Create: `src/modules/auth/dto/user.dto.ts`

- [ ] **Step 1: Create the file**

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiKeyRole } from '../entities/api-key.entity';

export class CreateUserDto {
  @ApiProperty({ example: 'alice@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ enum: ApiKeyRole, default: ApiKeyRole.OPERATOR })
  @IsOptional()
  @IsEnum(ApiKeyRole)
  role?: ApiKeyRole;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'alice@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: ApiKeyRole })
  @IsOptional()
  @IsEnum(ApiKeyRole)
  role?: ApiKeyRole;

  @ApiPropertyOptional()
  @IsOptional()
  isActive?: boolean;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class LoginDto {
  @ApiProperty({ example: 'admin@localhost' })
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ enum: ApiKeyRole })
  role: ApiKeyRole;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class LoginResponseDto {
  @ApiProperty()
  access_token: string;

  @ApiProperty()
  token_type: string;

  @ApiProperty()
  expires_in: number;

  @ApiProperty({ enum: ApiKeyRole })
  role: ApiKeyRole;

  @ApiProperty()
  email: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/auth/dto/user.dto.ts
git commit -m "feat(auth): add User DTOs (login, create, update, change-password)"
```

---

## Task 5: Create UserService with tests

**Files:**
- Create: `src/modules/auth/user.service.ts`
- Create: `src/modules/auth/user.service.spec.ts`

- [ ] **Step 1: Write the failing test file first**

Create `src/modules/auth/user.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { ApiKeyRole } from './entities/api-key.entity';

function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-uuid-1',
    email: 'alice@example.com',
    passwordHash: bcrypt.hashSync('password123', 1),
    role: ApiKeyRole.ADMIN,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('UserService', () => {
  let service: UserService;
  let repository: jest.Mocked<Partial<Repository<User>>>;
  let jwtService: jest.Mocked<Partial<JwtService>>;

  beforeEach(async () => {
    repository = {
      count: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mock.jwt.token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User, 'main'), useValue: repository },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  describe('create', () => {
    it('should hash password and save user', async () => {
      const mockUser = createMockUser({ email: 'bob@test.com' });
      (repository.findOne as jest.Mock).mockResolvedValue(null);
      (repository.create as jest.Mock).mockReturnValue(mockUser);
      (repository.save as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.create({ email: 'bob@test.com', password: 'secret123' });

      expect(result.email).toBe('bob@test.com');
      const createCall = (repository.create as jest.Mock).mock.calls[0][0];
      expect(createCall.passwordHash).toBeDefined();
      expect(createCall.passwordHash).not.toBe('secret123');
    });

    it('should throw ConflictException if email already exists', async () => {
      (repository.findOne as jest.Mock).mockResolvedValue(createMockUser());

      await expect(service.create({ email: 'alice@example.com', password: 'pass1234' }))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      const users = [createMockUser(), createMockUser({ id: 'user-2', email: 'bob@test.com' })];
      (repository.find as jest.Mock).mockResolvedValue(users);

      const result = await service.findAll();
      expect(result).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('should return user if found', async () => {
      const user = createMockUser();
      (repository.findOne as jest.Mock).mockResolvedValue(user);

      const result = await service.findOne('user-uuid-1');
      expect(result.id).toBe('user-uuid-1');
    });

    it('should throw NotFoundException if not found', async () => {
      (repository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update email and role', async () => {
      const user = createMockUser();
      (repository.findOne as jest.Mock).mockResolvedValue(user);
      (repository.save as jest.Mock).mockImplementation(u => Promise.resolve(u));

      const result = await service.update('user-uuid-1', { email: 'new@test.com', role: ApiKeyRole.VIEWER });
      expect(result.email).toBe('new@test.com');
      expect(result.role).toBe(ApiKeyRole.VIEWER);
    });
  });

  describe('delete', () => {
    it('should remove user', async () => {
      const user = createMockUser();
      (repository.findOne as jest.Mock).mockResolvedValue(user);
      (repository.remove as jest.Mock).mockResolvedValue(user);

      await service.delete('user-uuid-1');
      expect(repository.remove).toHaveBeenCalledWith(user);
    });
  });

  describe('login', () => {
    it('should return JWT token for valid credentials', async () => {
      const user = createMockUser();
      (repository.findOne as jest.Mock).mockResolvedValue(user);

      const result = await service.login({ email: 'alice@example.com', password: 'password123' });

      expect(result.access_token).toBe('mock.jwt.token');
      expect(result.token_type).toBe('Bearer');
      expect(result.role).toBe(ApiKeyRole.ADMIN);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const user = createMockUser();
      (repository.findOne as jest.Mock).mockResolvedValue(user);

      await expect(service.login({ email: 'alice@example.com', password: 'wrong' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      (repository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.login({ email: 'nobody@test.com', password: 'pass' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      const user = createMockUser({ isActive: false });
      (repository.findOne as jest.Mock).mockResolvedValue(user);

      await expect(service.login({ email: 'alice@example.com', password: 'password123' }))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('changePassword', () => {
    it('should update passwordHash when old password is correct', async () => {
      const user = createMockUser();
      (repository.findOne as jest.Mock).mockResolvedValue(user);
      (repository.save as jest.Mock).mockImplementation(u => Promise.resolve(u));

      await service.changePassword('user-uuid-1', 'password123', 'newpassword99');

      const saveCall = (repository.save as jest.Mock).mock.calls[0][0];
      const matches = await bcrypt.compare('newpassword99', saveCall.passwordHash);
      expect(matches).toBe(true);
    });

    it('should throw UnauthorizedException when old password is wrong', async () => {
      const user = createMockUser();
      (repository.findOne as jest.Mock).mockResolvedValue(user);

      await expect(service.changePassword('user-uuid-1', 'wrongpass', 'newpassword99'))
        .rejects.toThrow(UnauthorizedException);
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd c:/Dev/openwa
npx jest user.service.spec --no-coverage 2>&1 | tail -20
```

Expected: `Cannot find module './user.service'` error.

- [ ] **Step 3: Create UserService implementation**

Create `src/modules/auth/user.service.ts`:

```typescript
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
import { existsSync, writeFileSync } from 'fs';
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
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx jest user.service.spec --no-coverage 2>&1 | tail -20
```

Expected: `Tests: 13 passed, 13 total`

- [ ] **Step 5: Commit**

```bash
git add src/modules/auth/user.service.ts src/modules/auth/user.service.spec.ts
git commit -m "feat(auth): add UserService with bcrypt, JWT login, user CRUD, and seeding"
```

---

## Task 6: Create UserController

**Files:**
- Create: `src/modules/auth/user.controller.ts`

- [ ] **Step 1: Create the file**

```typescript
import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto, LoginDto, LoginResponseDto, ChangePasswordDto } from './dto/user.dto';
import { ApiKey, ApiKeyRole } from './entities/api-key.entity';
import { Public, RequireRole, CurrentApiKey } from './decorators/auth.decorators';

@ApiTags('auth')
@Controller('auth')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // ── Login ─────────────────────────────────────────────────────────

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password — returns JWT' })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  async login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.userService.login(dto);
  }

  // ── User management (ADMIN only) ──────────────────────────────────

  @Post('users')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a user (admin only)' })
  @ApiResponse({ status: 201, type: UserResponseDto })
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.userService.create(dto);
    return this.userService.toResponseDto(user);
  }

  @Get('users')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all users (admin only)' })
  @ApiResponse({ status: 200, type: [UserResponseDto] })
  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.userService.findAll();
    return users.map(u => this.userService.toResponseDto(u));
  }

  @Get('users/:id')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user by ID (admin only)' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async findOne(@Param('id') id: string): Promise<UserResponseDto> {
    const user = await this.userService.findOne(id);
    return this.userService.toResponseDto(user);
  }

  @Put('users/:id')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user (admin only)' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.userService.update(id, dto);
    return this.userService.toResponseDto(user);
  }

  @Delete('users/:id')
  @RequireRole(ApiKeyRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete user (admin only)' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.userService.delete(id);
  }

  // ── Change password (authenticated user, JWT-only) ────────────────

  @Post('users/me/change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change own password (JWT auth only)' })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() request: Request & { apiKey?: ApiKey; user?: { sub: string } },
  ): Promise<void> {
    // Only available when authenticated via JWT (request.user is set by guard)
    if (!request.user?.sub) {
      throw new ForbiddenException('Password change requires JWT authentication');
    }
    await this.userService.changePassword(request.user.sub, dto.oldPassword, dto.newPassword);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/auth/user.controller.ts
git commit -m "feat(auth): add UserController (login, user CRUD, change-password)"
```

---

## Task 7: Wire AuthModule

**Files:**
- Modify: `src/modules/auth/auth.module.ts`

- [ ] **Step 1: Replace auth.module.ts content**

```typescript
import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ApiKey } from './entities/api-key.entity';
import { User } from './entities/user.entity';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { AuthController } from './auth.controller';
import { AuthValidateController } from './auth-validate.controller';
import { UserController } from './user.controller';
import { ApiKeyGuard } from './guards/api-key.guard';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKey, User], 'main'),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: { expiresIn: config.get<string>('jwt.expiresIn') || '1d' },
      }),
    }),
  ],
  controllers: [AuthController, AuthValidateController, UserController],
  providers: [
    AuthService,
    UserService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
  ],
  exports: [AuthService, UserService],
})
export class AuthModule {}
```

- [ ] **Step 2: Verify build compiles**

```bash
cd c:/Dev/openwa
npm run build 2>&1 | tail -30
```

Expected: `Successfully compiled: N files with swc` (or tsc output with no errors).

- [ ] **Step 3: Commit**

```bash
git add src/modules/auth/auth.module.ts
git commit -m "feat(auth): wire JwtModule, User entity, UserService, UserController into AuthModule"
```

---

## Task 8: Modify ApiKeyGuard to accept JWT

**Files:**
- Modify: `src/modules/auth/guards/api-key.guard.ts`
- Modify: `src/modules/auth/guards/api-key.guard.spec.ts`

- [ ] **Step 1: Write failing tests for JWT path**

Open `src/modules/auth/guards/api-key.guard.spec.ts` and **replace its entire content**:

```typescript
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ApiKeyGuard } from './api-key.guard';
import { AuthService } from '../auth.service';
import { ApiKey, ApiKeyRole } from '../entities/api-key.entity';

function createMockApiKey(role = ApiKeyRole.ADMIN): ApiKey {
  return {
    id: 'key-1',
    name: 'Test',
    keyHash: '',
    keyPrefix: '',
    role,
    allowedIps: null,
    allowedSessions: null,
    isActive: true,
    expiresAt: null,
    lastUsedAt: null,
    usageCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeContext(headers: Record<string, string>, params = {}): ExecutionContext {
  const request = { headers, params, socket: {} };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let authService: jest.Mocked<Pick<AuthService, 'validateApiKey' | 'hasPermission'>>;
  let jwtService: jest.Mocked<Pick<JwtService, 'verifyAsync'>>;
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;

  beforeEach(() => {
    authService = {
      validateApiKey: jest.fn(),
      hasPermission: jest.fn().mockReturnValue(true),
    };
    jwtService = {
      verifyAsync: jest.fn(),
    };
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    };

    guard = new ApiKeyGuard(
      authService as unknown as AuthService,
      reflector as unknown as Reflector,
      jwtService as unknown as JwtService,
    );
  });

  describe('API key path (X-API-Key header)', () => {
    it('should pass when X-API-Key header is valid', async () => {
      const apiKey = createMockApiKey();
      authService.validateApiKey.mockResolvedValue(apiKey);
      const ctx = makeContext({ 'x-api-key': 'valid-key' });

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(authService.validateApiKey).toHaveBeenCalledWith('valid-key', expect.any(String), undefined);
      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it('should reject invalid X-API-Key', async () => {
      authService.validateApiKey.mockRejectedValue(new UnauthorizedException('Invalid API key'));
      const ctx = makeContext({ 'x-api-key': 'bad-key' });

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('JWT path (Authorization: Bearer)', () => {
    it('should pass when Bearer token is a valid JWT', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', email: 'a@b.com', role: ApiKeyRole.ADMIN });
      const ctx = makeContext({ authorization: 'Bearer valid.jwt.token' });

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid.jwt.token');
      expect(authService.validateApiKey).not.toHaveBeenCalled();
    });

    it('should attach synthetic apiKey and user payload to request on JWT auth', async () => {
      const payload = { sub: 'user-1', email: 'a@b.com', role: ApiKeyRole.ADMIN };
      jwtService.verifyAsync.mockResolvedValue(payload);
      const req = { headers: { authorization: 'Bearer valid.jwt.token' }, params: {}, socket: {} };
      const ctx = {
        switchToHttp: () => ({ getRequest: () => req }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      await guard.canActivate(ctx);

      expect((req as any).apiKey.role).toBe(ApiKeyRole.ADMIN);
      expect((req as any).apiKey.id).toBe('user-1');
      expect((req as any).user.sub).toBe('user-1');
    });

    it('should fall back to API key validation when Bearer token is not a JWT', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid token'));
      const apiKey = createMockApiKey();
      authService.validateApiKey.mockResolvedValue(apiKey);
      const ctx = makeContext({ authorization: 'Bearer raw-api-key-string' });

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(authService.validateApiKey).toHaveBeenCalledWith('raw-api-key-string', expect.any(String), undefined);
    });
  });

  describe('public routes', () => {
    it('should bypass auth for @Public() routes', async () => {
      (reflector.getAllAndOverride as jest.Mock).mockImplementation((key) =>
        key === 'isPublic' ? true : undefined,
      );
      const ctx = makeContext({});

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(authService.validateApiKey).not.toHaveBeenCalled();
    });
  });

  describe('missing token', () => {
    it('should throw UnauthorizedException when no auth provided', async () => {
      const ctx = makeContext({});

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest api-key.guard.spec --no-coverage 2>&1 | tail -20
```

Expected: failures — `JwtService` not injected yet.

- [ ] **Step 3: Replace api-key.guard.ts**

Replace the entire content of `src/modules/auth/guards/api-key.guard.ts`:

```typescript
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { ApiKey, ApiKeyRole } from '../entities/api-key.entity';
import { REQUIRED_ROLE_KEY, PUBLIC_KEY } from '../decorators/auth.decorators';
import { JwtPayload } from '../user.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { apiKey?: ApiKey; user?: JwtPayload }>();
    const requiredRole = this.reflector.getAllAndOverride<ApiKeyRole>(REQUIRED_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const clientIp = this.getClientIp(request);
    const sessionId = (request.params['sessionId'] || request.params['id']) as string | undefined;

    // X-API-Key header — always treat as raw API key
    const xApiKey = request.headers['x-api-key'] as string;
    if (xApiKey) {
      const apiKey = await this.authService.validateApiKey(xApiKey, clientIp, sessionId);
      this.checkRole(apiKey, requiredRole);
      request.apiKey = apiKey;
      return true;
    }

    // Authorization: Bearer — try JWT first, fall back to raw API key
    const authHeader = request.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      const jwtPayload = await this.tryVerifyJwt(token);
      if (jwtPayload) {
        const principal = this.buildPrincipalFromJwt(jwtPayload);
        this.checkRole(principal, requiredRole);
        request.apiKey = principal;
        request.user = jwtPayload;
        return true;
      }

      // Fallback: treat Bearer value as raw API key (backward compat)
      const apiKey = await this.authService.validateApiKey(token, clientIp, sessionId);
      this.checkRole(apiKey, requiredRole);
      request.apiKey = apiKey;
      return true;
    }

    throw new UnauthorizedException('API key is required');
  }

  private async tryVerifyJwt(token: string): Promise<JwtPayload | null> {
    try {
      return await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      return null;
    }
  }

  private buildPrincipalFromJwt(payload: JwtPayload): ApiKey {
    return {
      id: payload.sub,
      name: payload.email,
      role: payload.role,
      isActive: true,
      keyHash: '',
      keyPrefix: '',
      allowedIps: null,
      allowedSessions: null,
      expiresAt: null,
      lastUsedAt: null,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as ApiKey;
  }

  private checkRole(apiKey: ApiKey, requiredRole: ApiKeyRole | undefined): void {
    if (requiredRole && !this.authService.hasPermission(apiKey, requiredRole)) {
      throw new UnauthorizedException(`Insufficient permissions. Required: ${requiredRole}`);
    }
  }

  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = (forwarded as string).split(',');
      return ips[0].trim();
    }
    return request.ip || request.socket.remoteAddress || '';
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx jest api-key.guard.spec --no-coverage 2>&1 | tail -20
```

Expected: `Tests: N passed`

- [ ] **Step 5: Run full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -30
```

Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/modules/auth/guards/api-key.guard.ts src/modules/auth/guards/api-key.guard.spec.ts
git commit -m "feat(auth): extend ApiKeyGuard to verify JWT Bearer tokens before API key fallback"
```

---

## Task 9: Update validate endpoint for JWT-authenticated requests

**Files:**
- Modify: `src/modules/auth/auth-validate.controller.ts`

The current controller reads `X-API-Key` header directly and re-validates. When a JWT user hits this endpoint (called by App.tsx on mount), the guard already validates the token and attaches `request.apiKey`. The controller must return the role from that attached principal.

- [ ] **Step 1: Replace auth-validate.controller.ts content**

```typescript
import { Controller, Post, Headers, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { ApiKey } from './entities/api-key.entity';
import { createLogger } from '../../common/services/logger.service';

@ApiTags('auth')
@Controller('auth')
export class AuthValidateController {
  private readonly logger = createLogger('AuthValidateController');

  constructor(private readonly authService: AuthService) {}

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate an API key or JWT token' })
  @ApiHeader({ name: 'X-API-Key', description: 'API key to validate', required: false })
  @ApiResponse({ status: 200, description: 'Token is valid' })
  @ApiResponse({ status: 401, description: 'Invalid or missing token' })
  async validate(
    @Headers('x-api-key') apiKeyHeader: string | undefined,
    @Req() request: Request & { apiKey?: ApiKey },
  ): Promise<{ valid: boolean; role?: string }> {
    // Guard already validated token (JWT or Bearer API key) — use attached principal
    if (request.apiKey) {
      return { valid: true, role: request.apiKey.role };
    }

    // Direct X-API-Key validation (no Authorization header provided)
    if (!apiKeyHeader) {
      return { valid: false };
    }

    try {
      const keyEntity = await this.authService.validateApiKey(apiKeyHeader);
      return keyEntity?.isActive ? { valid: true, role: keyEntity.role } : { valid: false };
    } catch (error) {
      this.logger.warn('API key validation error', { error: error instanceof Error ? error.message : String(error) });
      return { valid: false };
    }
  }
}
```

- [ ] **Step 2: Build to verify no type errors**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/auth/auth-validate.controller.ts
git commit -m "fix(auth): return role from guard-attached principal in validate endpoint (supports JWT)"
```

---

## Task 10: Dashboard — JWT-aware API client

**Files:**
- Modify: `dashboard/src/services/api.ts`

The `request()` function currently always sends `X-API-Key`. It must send `Authorization: Bearer <jwt>` when `openwa_jwt` is in sessionStorage.

- [ ] **Step 1: Update the request() function in api.ts**

Find the `request()` function (around line 148) and replace the headers block:

Old:
```typescript
  // Get API key from sessionStorage for authentication
  const apiKey = sessionStorage.getItem('openwa_api_key');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(apiKey ? { 'X-API-Key': apiKey } : {}),
    ...options.headers,
  };
```

New:
```typescript
  // Prefer JWT when available, fall back to API key
  const jwt = sessionStorage.getItem('openwa_jwt');
  const apiKey = sessionStorage.getItem('openwa_api_key');

  const authHeader: Record<string, string> = jwt
    ? { Authorization: `Bearer ${jwt}` }
    : apiKey
    ? { 'X-API-Key': apiKey }
    : {};

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...authHeader,
    ...options.headers,
  };
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/services/api.ts
git commit -m "feat(dashboard): send Authorization Bearer JWT when openwa_jwt is in sessionStorage"
```

---

## Task 11: Dashboard — App.tsx JWT-aware login/logout/mount validation

**Files:**
- Modify: `dashboard/src/App.tsx`

- [ ] **Step 1: Replace AppContent function in App.tsx**

Replace the entire `AppContent` function (lines 32–118) with:

```typescript
function AppContent() {
  const savedKey = sessionStorage.getItem('openwa_api_key');
  const savedJwt = sessionStorage.getItem('openwa_jwt');

  const [isAuthenticated, setIsAuthenticated] = useState(!!(savedKey || savedJwt));
  const { setRole, role } = useRole();

  // API key login (existing flow)
  const handleLogin = async (key: string) => {
    sessionStorage.setItem('openwa_api_key', key);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/validate`, {
        method: 'POST',
        headers: { 'X-API-Key': key },
      });
      if (response.ok) {
        const data = await response.json();
        setRole(data.role as UserRole);
      }
    } catch {
      setRole('viewer');
    }

    setIsAuthenticated(true);
  };

  // JWT login (email/password flow)
  const handleLoginJwt = (token: string, userRole: UserRole) => {
    sessionStorage.setItem('openwa_jwt', token);
    setRole(userRole);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('openwa_api_key');
    sessionStorage.removeItem('openwa_jwt');
    setIsAuthenticated(false);
    setRole(null);
  };

  // Re-validate on mount if already authenticated
  useEffect(() => {
    const jwt = sessionStorage.getItem('openwa_jwt');
    const apiKey = sessionStorage.getItem('openwa_api_key');

    if (jwt) {
      fetch(`${API_BASE_URL}/auth/validate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
      })
        .then(res => res.json())
        .then(data => {
          if (data.valid && data.role) {
            setRole(data.role as UserRole);
          } else {
            sessionStorage.removeItem('openwa_jwt');
            setIsAuthenticated(false);
          }
        })
        .catch(() => {});
    } else if (apiKey) {
      fetch(`${API_BASE_URL}/auth/validate`, {
        method: 'POST',
        headers: { 'X-API-Key': apiKey },
      })
        .then(res => res.json())
        .then(data => {
          if (data.valid && data.role) {
            setRole(data.role as UserRole);
          }
        })
        .catch(() => {});
    }
  }, [setRole]);

  const loadingFallback = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <Loader2 className="animate-spin" size={32} />
    </div>
  );

  if (!isAuthenticated) {
    return (
      <Suspense fallback={loadingFallback}>
        <Login onLogin={handleLogin} onLoginJwt={handleLoginJwt} />
      </Suspense>
    );
  }

  return (
    <ToastProvider>
      <BrowserRouter>
        <Suspense fallback={loadingFallback}>
          <Routes>
            <Route path="/" element={<Layout onLogout={handleLogout} userRole={role} />}>
              <Route index element={<Dashboard />} />
              <Route path="sessions" element={<Sessions />} />
              <Route path="webhooks" element={<Webhooks />} />
              {role === 'admin' && <Route path="api-keys" element={<ApiKeys />} />}
              <Route path="logs" element={<Logs />} />
              <Route path="message-tester" element={<MessageTester />} />
              <Route path="infrastructure" element={<Infrastructure />} />
              {role === 'admin' && <Route path="plugins" element={<Plugins />} />}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
  );
}
```

Also update the `UserRole` import — `handleLoginJwt` uses it directly. The existing import `import { RoleProvider, useRole, type UserRole } from './hooks/useRole';` already covers this.

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/App.tsx
git commit -m "feat(dashboard): support JWT login flow alongside existing API key login"
```

---

## Task 12: Dashboard — Login.tsx email/password tab

**Files:**
- Modify: `dashboard/src/pages/Login.tsx`
- Modify: `dashboard/src/pages/Login.css`

- [ ] **Step 1: Replace Login.tsx**

```typescript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Github } from 'lucide-react';
import { API_BASE_URL } from '../services/api';
import type { UserRole } from '../hooks/useRole';
import './Login.css';

interface LoginProps {
  onLogin: (apiKey: string) => void;
  onLoginJwt: (token: string, role: UserRole) => void;
}

export function Login({ onLogin, onLoginJwt }: LoginProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'apikey' | 'email'>('apikey');

  // API key state
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  // Email/password state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleApiKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError(t('login.apiKeyRequired'));
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      });

      if (response.ok) {
        onLogin(apiKey);
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.message || t('login.invalidKey'));
      }
    } catch {
      setError(t('login.connectionError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        onLoginJwt(data.access_token, data.role as UserRole);
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.message || 'Invalid email or password');
      }
    } catch {
      setError(t('login.connectionError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <img src="/openwa_logo.webp" alt="OpenWA" className="logo-icon" />
          <span className="version-info">
            {t('login.version', {
              version: __APP_VERSION__,
              date: new Date(__BUILD_TIME__).toLocaleDateString(),
            })}
          </span>
        </div>

        <div className="login-tabs">
          <button
            type="button"
            className={`login-tab ${tab === 'apikey' ? 'active' : ''}`}
            onClick={() => { setTab('apikey'); setError(''); }}
          >
            {t('login.apiKey')}
          </button>
          <button
            type="button"
            className={`login-tab ${tab === 'email' ? 'active' : ''}`}
            onClick={() => { setTab('email'); setError(''); }}
          >
            Email &amp; Password
          </button>
        </div>

        {tab === 'apikey' && (
          <form onSubmit={handleApiKeySubmit} className="login-form">
            <div className="input-group">
              <label htmlFor="apiKey">{t('login.apiKey')}</label>
              <div className="input-wrapper">
                <input
                  id="apiKey"
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder={t('login.apiKeyPlaceholder')}
                  className={error ? 'error' : ''}
                />
                <button type="button" className="toggle-visibility" onClick={() => setShowKey(!showKey)}>
                  {showKey ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {error && <span className="error-message">{error}</span>}
            </div>
            <button type="submit" className="connect-btn" disabled={isLoading}>
              {isLoading ? t('login.connecting') : t('login.connect')}
            </button>
          </form>
        )}

        {tab === 'email' && (
          <form onSubmit={handleEmailSubmit} className="login-form">
            <div className="input-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@localhost"
                className={error ? 'error' : ''}
              />
            </div>
            <div className="input-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={error ? 'error' : ''}
                />
                <button type="button" className="toggle-visibility" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {error && <span className="error-message">{error}</span>}
            </div>
            <button type="submit" className="connect-btn" disabled={isLoading}>
              {isLoading ? t('login.connecting') : t('login.connect')}
            </button>
          </form>
        )}

        <p className="login-help">
          {t('login.help')}{' '}
          <a
            href="https://github.com/rmyndharis/OpenWA/blob/main/docs/01-project-overview.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('login.viewDocs')}
          </a>
        </p>
      </div>

      <footer className="login-footer">
        <span>{t('login.footer')}</span>
        <a
          href="https://github.com/rmyndharis/OpenWA"
          target="_blank"
          rel="noopener noreferrer"
          className="github-link"
        >
          <Github size={18} />
        </a>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Add tab styles to Login.css**

Append to the end of `dashboard/src/pages/Login.css`:

```css
/* Login tabs */
.login-tabs {
  display: flex;
  border-bottom: 2px solid var(--border);
  margin-bottom: 1.5rem;
  gap: 0;
}

.login-tab {
  flex: 1;
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
}

.login-tab:hover {
  color: var(--text-primary);
}

.login-tab.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}
```

- [ ] **Step 3: Build dashboard to verify no TS errors**

```bash
cd c:/Dev/openwa/dashboard
npm run build 2>&1 | tail -30
```

Expected: build succeeds with no type errors.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/pages/Login.tsx dashboard/src/pages/Login.css
git commit -m "feat(dashboard): add email/password login tab with JWT flow"
```

---

## Task 13: Final verification

- [ ] **Step 1: Run full backend test suite**

```bash
cd c:/Dev/openwa
npx jest --no-coverage 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 2: Start the API server**

```bash
npm run start:dev
```

Watch for startup logs. Expected output includes:
```
Default admin user created — email: admin@localhost, password: admin
```
(dev environment)

- [ ] **Step 3: Test login endpoint via curl**

```bash
curl -s -X POST http://localhost:2785/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@localhost","password":"admin"}' | npx -y jq .
```

Expected:
```json
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "role": "admin",
  "email": "admin@localhost"
}
```

- [ ] **Step 4: Test JWT on a protected endpoint**

```bash
TOKEN=$(curl -s -X POST http://localhost:2785/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@localhost","password":"admin"}' | npx -y jq -r .access_token)

curl -s http://localhost:2785/api/auth/api-keys \
  -H "Authorization: Bearer $TOKEN" | npx -y jq .
```

Expected: list of API keys (shows Bearer JWT works on ADMIN-only endpoints).

- [ ] **Step 5: Verify existing API key auth still works**

```bash
curl -s http://localhost:2785/api/auth/api-keys \
  -H "X-API-Key: dev-admin-key" | npx -y jq .
```

Expected: same list — existing API key flow unchanged.

- [ ] **Step 6: Test dashboard**

```bash
npm run dashboard:dev
```

Open `http://localhost:2886`. Verify:
- Two tabs visible: "API Key" and "Email & Password"
- Email tab: login with `admin@localhost` / `admin` → dashboard opens
- API key tab: login with `dev-admin-key` → dashboard opens (existing behavior preserved)
- Logout → clears both storage keys

- [ ] **Step 7: Final commit if any loose files**

```bash
git status
git add -p   # stage any remaining changes
git commit -m "feat(auth): complete email/password auth with JWT — full stack"
```

---

## Environment Variables to Document

Add to `.env.minimal` (optional, all have safe defaults):

```bash
# JWT (email/password auth) — CHANGE IN PRODUCTION
# JWT_SECRET=your-secret-here
# JWT_EXPIRES_IN=1d
```

Default admin credentials (dev): `admin@localhost` / `admin`
Production: random password written to `data/.admin-password` on first boot.
