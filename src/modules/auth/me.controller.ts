import { Controller, Get, Put, Post, Body, HttpCode, HttpStatus, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { UserService } from './user.service';
import { UpdateMeDto, UserResponseDto, ChangePasswordDto } from './dto/user.dto';
import { ApiKey } from './entities/api-key.entity';

@ApiTags('auth')
@Controller('auth/users')
export class MeController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get own profile (JWT auth only)' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async getMe(@Req() request: Request & { user?: { sub: string } }): Promise<UserResponseDto> {
    if (!request.user?.sub) {
      throw new ForbiddenException('Requires JWT authentication');
    }
    const user = await this.userService.findOne(request.user.sub);
    return this.userService.toResponseDto(user);
  }

  @Put('me')
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

  @Post('me/change-password')
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
}
