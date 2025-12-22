/**
 * Integration Tests for 4.1.3 JWT Security
 * Test Case IDs: TC-4.1.4-01 to TC-4.1.4-05
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../../server/src/prisma/prisma.service';
import { AppModule } from '../../../server/src/app/app.module';
import { UserRole } from '../../../server/generated';
import {
  createTestJWT,
  createExpiredJWT,
  createInvalidJWT,
  createTestUser,
  cleanupTestUsers,
  TestUser,
} from '../helpers/test-helpers';

describe('4.1.3 JWT Security', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let testUser: TestUser;

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
    testUser = await createTestUser(prisma, {
      email: 'jwt_test@test.com',
      role: UserRole.bidder,
    });
  });

  describe('Token Validation', () => {
    it('TC-4.1.3-01: Reject expired JWT token', async () => {
      const expiredToken = createExpiredJWT(testUser);

      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.message).toMatch(/expired|invalid|unauthorized/i);
    });

    it('TC-4.1.3-02: Reject JWT with invalid signature', async () => {
      const invalidToken = createInvalidJWT(testUser);

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);
    });

    it('TC-4.1.3-03: Reject malformed JWT', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer not.a.valid.jwt.token')
        .expect(401);
    });

    it('TC-4.1.3-04: Reject missing Bearer prefix', async () => {
      const validToken = createTestJWT(testUser, UserRole.bidder);

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', validToken) // Missing "Bearer "
        .expect(401);
    });

    it('TC-4.1.3-05: Accept valid JWT token', async () => {
      const validToken = createTestJWT(testUser, UserRole.bidder);

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);
    });
  });

  describe('Token Tampering', () => {
    it('TC-4.1.3-06: Reject JWT with modified payload', async () => {
      const validToken = createTestJWT(testUser, UserRole.bidder);

      // Split token and modify payload
      const parts = validToken.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      payload.role = 'admin'; // Modify role
      parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const tamperedToken = parts.join('.');

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tamperedToken}`)
        .expect(401);
    });

    it('TC-4.1.3-07: Reject none algorithm token', async () => {
      // Create a token with "alg": "none" (known JWT vulnerability)
      const header = Buffer.from('{"alg":"none","typ":"JWT"}').toString(
        'base64url'
      );
      const payload = Buffer.from(
        JSON.stringify({
          sub: testUser.id,
          email: testUser.email,
          role: 'admin',
        })
      ).toString('base64url');
      const noneToken = `${header}.${payload}.`;

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${noneToken}`)
        .expect(401);
    });
  });
});
