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
