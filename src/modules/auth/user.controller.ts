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
import { CreateUserDto, UpdateUserDto, UpdateMeDto, UserResponseDto, LoginDto, LoginResponseDto, ChangePasswordDto } from './dto/user.dto';
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

  // ── Self-service profile (JWT-only) — MUST be before /:id routes ──

  @Get('users/me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get own profile (JWT auth only)' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async getMe(
    @Req() request: Request & { user?: { sub: string } },
  ): Promise<UserResponseDto> {
    if (!request.user?.sub) {
      throw new ForbiddenException('Requires JWT authentication');
    }
    const user = await this.userService.findOne(request.user.sub);
    return this.userService.toResponseDto(user);
  }

  @Put('users/me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update own email (JWT auth only)' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async updateMe(
    @Body() dto: UpdateMeDto,
    @Req() request: Request & { user?: { sub: string } },
  ): Promise<UserResponseDto> {
    if (!request.user?.sub) {
      throw new ForbiddenException('Requires JWT authentication');
    }
    const user = await this.userService.update(request.user.sub, { email: dto.email });
    return this.userService.toResponseDto(user);
  }

  @Post('users/me/change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change own password (JWT auth only)' })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() request: Request & { apiKey?: ApiKey; user?: { sub: string } },
  ): Promise<void> {
    if (!request.user?.sub) {
      throw new ForbiddenException('Password change requires JWT authentication');
    }
    await this.userService.changePassword(request.user.sub, dto.oldPassword, dto.newPassword);
  }

  // ── User management (ADMIN only) ─────────────────────────────────

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
}
