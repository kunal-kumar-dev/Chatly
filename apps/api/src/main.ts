import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { loadEnvironment } from './config/load-environment';

async function bootstrap() {
  loadEnvironment();

  if (process.env.NODE_ENV === 'production') {
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    if (!accessSecret || accessSecret.length < 32 || accessSecret.includes('change-in-production')) {
      throw new Error('JWT_ACCESS_SECRET must be a unique value of at least 32 characters in production');
    }
  }

  const app = await NestFactory.create(AppModule);
  
  app.use(helmet());
  app.enableCors({
    origin: process.env.WEB_URL || 'http://localhost:3000',
    credentials: true,
  });
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  
  app.setGlobalPrefix('api');
  
  const port = process.env.API_PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 API running on http://localhost:${port}/api`);
}
bootstrap();
