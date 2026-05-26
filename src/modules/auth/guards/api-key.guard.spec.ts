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
