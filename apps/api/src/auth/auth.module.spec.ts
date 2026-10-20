import { Test } from '@nestjs/testing';
import { AuthModule } from './auth.module';

describe('AuthModule', () => {
  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-long-enough';
  });

  it('resolves AuthService and its JwtService dependency', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
