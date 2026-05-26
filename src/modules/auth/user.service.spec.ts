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
      decode: jest.fn().mockReturnValue({ iat: 0, exp: 86400 }),
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
      const createCall = ((repository.create as jest.Mock).mock.calls as Array<[{ passwordHash: string }]>)[0][0];
      expect(createCall.passwordHash).toBeDefined();
      expect(createCall.passwordHash).not.toBe('secret123');
    });

    it('should throw ConflictException if email already exists', async () => {
      (repository.findOne as jest.Mock).mockResolvedValue(createMockUser());

      await expect(service.create({ email: 'alice@example.com', password: 'pass1234' })).rejects.toThrow(
        ConflictException,
      );
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
      (repository.findOne as jest.Mock)
        .mockResolvedValueOnce(user) // first call: findOne(id)
        .mockResolvedValueOnce(null); // second call: duplicate email check
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

      await expect(service.login({ email: 'alice@example.com', password: 'wrong' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      (repository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.login({ email: 'nobody@test.com', password: 'pass' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      const user = createMockUser({ isActive: false });
      (repository.findOne as jest.Mock).mockResolvedValue(user);

      await expect(service.login({ email: 'alice@example.com', password: 'password123' })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('changePassword', () => {
    it('should update passwordHash when old password is correct', async () => {
      const user = createMockUser();
      (repository.findOne as jest.Mock).mockResolvedValue(user);
      (repository.save as jest.Mock).mockImplementation(u => Promise.resolve(u));

      await service.changePassword('user-uuid-1', 'password123', 'newpassword99');

      const saveCall = ((repository.save as jest.Mock).mock.calls as Array<[{ passwordHash: string }]>)[0][0];
      const matches = await bcrypt.compare('newpassword99', saveCall.passwordHash);
      expect(matches).toBe(true);
    });

    it('should throw UnauthorizedException when old password is wrong', async () => {
      const user = createMockUser();
      (repository.findOne as jest.Mock).mockResolvedValue(user);

      await expect(service.changePassword('user-uuid-1', 'wrongpass', 'newpassword99')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('onModuleInit', () => {
    it('should create default admin user when no users exist', async () => {
      (repository.count as jest.Mock).mockResolvedValue(0);
      (repository.create as jest.Mock).mockReturnValue({ email: 'admin@localhost' });
      (repository.save as jest.Mock).mockResolvedValue({});

      await service.onModuleInit();

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'admin@localhost', role: ApiKeyRole.ADMIN }),
      );
      expect(repository.save).toHaveBeenCalled();
    });

    it('should not create user when users already exist', async () => {
      (repository.count as jest.Mock).mockResolvedValue(1);

      await service.onModuleInit();

      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });
});
