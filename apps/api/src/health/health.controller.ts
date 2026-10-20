import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { prisma } from '@chatly/database';
import { Public } from '../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('ready')
  async ready() {
    try {
      if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is not configured');
      }
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', timestamp: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException('Database is unavailable');
    }
  }
}
