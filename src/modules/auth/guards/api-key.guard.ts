import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { ApiKey, ApiKeyRole } from '../entities/api-key.entity';
import { REQUIRED_ROLE_KEY, PUBLIC_KEY } from '../decorators/auth.decorators';
import { JwtPayload, UserService } from '../user.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [context.getHandler(), context.getClass()]);
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
        let user;
        try {
          user = await this.userService.findOne(jwtPayload.sub);
        } catch {
          // User deleted after JWT was issued — treat as invalid token
          throw new UnauthorizedException('Invalid or expired token');
        }
        if (!user.isActive) {
          throw new UnauthorizedException('User account is deactivated');
        }
        // Use role from DB, not JWT payload, so role changes take effect immediately
        const principal = this.buildPrincipalFromJwt({ ...jwtPayload, role: user.role });
        this.checkRole(principal, requiredRole);
        request.apiKey = principal;
        request.user = { ...jwtPayload, role: user.role };
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
    };
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
