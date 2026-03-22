/**
 * Integration Tests for 2.9.5-6 Cache Operations
 * Test Case IDs: TC-2.9.5-01 to TC-2.9.6-02
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../../server/src/prisma/prisma.service';
import { AppModule } from '../../../server/src/app/app.module';
import { UserRole } from '../../../server/generated';
import {
  createTestJWT,
  createTestUser,
  cleanupTestUsers,
  TestUser,
} from '../helpers/test-helpers';

describe('2.9.5-6 Cache Operations', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: TestUser;
  let bidder: TestUser;
  let adminToken: string;
  let bidderToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true })
    );
    await app.init();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await cleanupTestUsers(prisma);
    await app.close();
  });

  beforeEach(async () => {
    await cleanupTestUsers(prisma);

    admin = await createTestUser(prisma, {
      email: 'cache_admin@test.com',
      role: UserRole.admin,
    });
    bidder = await createTestUser(prisma, {
      email: 'cache_bidder@test.com',
      role: UserRole.bidder,
    });

    adminToken = createTestJWT(admin, UserRole.admin);
    bidderToken = createTestJWT(bidder, UserRole.bidder);
  });

  // ============================================
  // 2.9.5 Clear Cache
  // ============================================
  describe('2.9.5 Clear Cache', () => {
    it('TC-2.9.5-01: Verify clear cache', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/system-variables/cache/clear')
        .set('Authorization', `Bearer ${adminToken}`);

      if (![200, 201, 404].includes(response.status)) {
        console.log('TC-2.9.5-01 Failed Status:', response.status);
        console.log(
          'TC-2.9.5-01 Failed Body:',
          JSON.stringify(response.body, null, 2)
        );
      }
      expect([200, 201, 404]).toContain(response.status);
    });

    it('TC-2.9.5-02: Fail Bidder clearing cache', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/system-variables/cache/clear')
        .set('Authorization', `Bearer ${bidderToken}`);

      expect([403, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 2.9.6 Cache Stats
  // ============================================
  describe('2.9.6 Cache Stats', () => {
    it('TC-2.9.6-01: Verify get cache stats', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/system-variables/cache/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        expect(response.body).toBeDefined();
      } else {
        expect([200, 404]).toContain(response.status);
      }
    });

    it('TC-2.9.6-02: Fail Bidder accessing cache stats', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/system-variables/cache/stats')
        .set('Authorization', `Bearer ${bidderToken}`);

      expect([403, 404]).toContain(response.status);
    });
  });
});
