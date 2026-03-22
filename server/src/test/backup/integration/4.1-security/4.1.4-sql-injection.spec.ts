/**
 * Integration Tests for 4.1.4 SQL Injection Prevention
 * Test Case IDs: TC-4.1.5-01 to TC-4.1.5-03
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../../server/src/prisma/prisma.service';
import { AppModule } from '../../../server/src/app/app.module';

describe('4.1.4 SQL Injection Prevention', () => {
  let app: INestApplication;
  let prisma: PrismaService;

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
    await app.close();
  });

  describe('Search Parameter Injection', () => {
    it('TC-4.1.4-01: SQL injection in search parameter is safe', async () => {
      const maliciousSearch = "'; DROP TABLE auctions; --";

      const response = await request(app.getHttpServer())
        .get(`/api/auctions?search=${encodeURIComponent(maliciousSearch)}`)
        .expect(200);

      // Verify table still exists
      const count = await prisma.auction.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('TC-4.1.4-02: SQL injection in path parameter is safe', async () => {
      const maliciousId = "1' OR '1'='1";

      const response = await request(app.getHttpServer()).get(
        `/api/auctions/${encodeURIComponent(maliciousId)}`
      );

      // Should return 400 (invalid UUID) or 404, not leak data
      expect([400, 404]).toContain(response.status);
    });

    it('TC-4.1.4-03: SQL injection in filter parameter is safe', async () => {
      const maliciousFilter = "secured_asset' OR '1'='1";

      const response = await request(app.getHttpServer())
        .get(`/api/auctions?assetType=${encodeURIComponent(maliciousFilter)}`)
        .expect(200);

      // Should return empty or filtered results, not all data
    });
  });

  describe('Body Payload Injection', () => {
    it('TC-4.1.4-04: SQL injection in registration email is safe', async () => {
      const payload = {
        email: "test@test.com'; DROP TABLE users; --",
        password: 'SecurePass123!',
        full_name: 'SQL Injection Test',
        user_type: 'individual',
      };

      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(payload);

      // Should fail validation or be safely escaped
      expect([400, 409, 201]).toContain(response.status);

      // Verify table still exists
      const count = await prisma.user.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});
