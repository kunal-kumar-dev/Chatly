import { UnauthorizedException } from '@nestjs/common';
import { prisma } from '@chatly/database';
import { AuthService } from './auth.service';

jest.mock('@chatly/database', () => ({
  prisma: {
    refreshToken: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a refresh token already rotated by a concurrent request', async () => {
    const service = new AuthService({
      signAsync: jest.fn(),
    } as never);
    jest.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
      id: 'refresh-token-id',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'user-id', email: 'user@example.com' },
    } as never);
    jest.mocked(prisma.refreshToken.updateMany).mockResolvedValue({ count: 0 });

    await expect(service.refresh('refresh-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'refresh-token-id',
        revokedAt: null,
        expiresAt: expect.objectContaining({ gt: expect.any(Date) }),
      }),
    }));
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });
});
