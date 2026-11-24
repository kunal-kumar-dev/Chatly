import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { prisma } from '@chatly/database';
import * as argon2 from 'argon2';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { SYSTEM_ROLES } from '@chatly/authorization';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async register(registerDto: RegisterDto) {
    const { email, password, firstName, lastName, displayName } = registerDto;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await argon2.hash(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        displayName: displayName || `${firstName} ${lastName}`,
      },
    });

    // Create default workspace for new user or join demo workspace
    const workspace = await prisma.workspace.findFirst({ where: { slug: 'demo' } });
    if (workspace) {
      await prisma.userWorkspace.create({
        data: { userId: user.id, workspaceId: workspace.id },
      });

      const memberRole = await prisma.role.findUnique({ where: { name: SYSTEM_ROLES.MEMBER } });
      if (memberRole) {
        await prisma.userRole.create({
          data: {
            userId: user.id,
            roleId: memberRole.id,
            scopeType: 'workspace',
            scopeId: workspace.id,
          },
        });
      }
    }

    return this.generateTokens(user.id, user.email);
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.generateTokens(user.id, user.email);
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token required');
    }

    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !storedToken
      || storedToken.revokedAt
      || storedToken.expiresAt < new Date()
      || !storedToken.user.isActive
      || storedToken.user.deletedAt
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const rotation = await prisma.refreshToken.updateMany({
      where: {
        id: storedToken.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { revokedAt: new Date() },
    });
    if (rotation.count !== 1) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.generateTokens(storedToken.user.id, storedToken.user.email);
  }

  async logout(userId: string, refreshToken: string) {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await prisma.refreshToken.updateMany({
        where: { tokenHash, userId },
        data: { revokedAt: new Date() },
      });
    }
    return { success: true };
  }

  async getMe(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        displayName: true,
        avatarUrl: true,
        statusMessage: true,
        timezone: true,
        isActive: true,
        isEmailVerified: true,
        lastSeenAt: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
  }

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    });

    const refreshToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(refreshToken);

    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return { accessToken, refreshToken, expiresIn: 900 };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
