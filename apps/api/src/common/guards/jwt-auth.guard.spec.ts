import { ExecutionContext } from '@nestjs/common';
import { prisma } from '@chatly/database';
import { JwtAuthGuard } from './jwt-auth.guard';

jest.mock('@chatly/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

describe('JwtAuthGuard', () => {
  it('allows endpoints decorated with @Public without requiring a token', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    };
    const guard = new JwtAuthGuard(undefined as never, reflector as never);
    const context = {
      getType: jest.fn().mockReturnValue('http'),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('leaves websocket authentication to the gateway', async () => {
    const reflector = {
      getAllAndOverride: jest.fn(),
    };
    const guard = new JwtAuthGuard(undefined as never, reflector as never);
    const context = {
      getType: jest.fn().mockReturnValue('ws'),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(reflector.getAllAndOverride).not.toHaveBeenCalled();
  });

  it('does not disguise database failures as invalid credentials', async () => {
    const databaseError = new Error('Database unavailable');
    jest.mocked(prisma.user.findUnique).mockRejectedValue(databaseError);
    const jwtService = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-id' }),
    };
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    };
    const guard = new JwtAuthGuard(jwtService as never, reflector as never);
    const context = {
      getType: jest.fn().mockReturnValue('http'),
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: 'Bearer valid-token' } }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toBe(databaseError);
  });
});
