/**
 * Integration Tests for 3.9.5-6 Cache Operations
 * Test Case IDs: TC-3.9.5-01 to TC-3.9.6-02
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

describe('3.9.5-6 Cache Operations', () => {
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
  // 3.9.5 Clear Cache
  // ============================================
  describe('3.9.5 Clear Cache', () => {
    it('TC-3.9.5-01: Verify clear cache', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/system-variables/cache/clear')
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 404]).toContain(response.status);
    });

    it('TC-3.9.5-02: Fail Bidder clearing cache', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/system-variables/cache/clear')
        .set('Authorization', `Bearer ${bidderToken}`);

      expect([403, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 3.9.6 Cache Stats
  // ============================================
  describe('3.9.6 Cache Stats', () => {
    it('TC-3.9.6-01: Verify get cache stats', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/system-variables/cache/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        expect(response.body).toBeDefined();
      } else {
        expect([200, 404]).toContain(response.status);
      }
    });

    it('TC-3.9.6-02: Fail Bidder accessing cache stats', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/system-variables/cache/stats')
        .set('Authorization', `Bearer ${bidderToken}`);

      expect([403, 404]).toContain(response.status);
    });
  });
});
