/**
 * Integration Tests for 3.9.1-4 System Variables CRUD
 * Test Case IDs: TC-3.9.1-01 to TC-3.9.4-04
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

describe('3.9.1-4 System Variables CRUD', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: TestUser;
  let auctioneer: TestUser;
  let bidder: TestUser;
  let adminToken: string;
  let auctioneerToken: string;
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
    // Clean test system variables
    await prisma.systemVariable.deleteMany({
      where: { category: { startsWith: 'TEST' } },
    });

    admin = await createTestUser(prisma, {
      email: 'sysvar_admin@test.com',
      role: UserRole.admin,
    });
    auctioneer = await createTestUser(prisma, {
      email: 'sysvar_auctioneer@test.com',
      role: UserRole.auctioneer,
    });
    bidder = await createTestUser(prisma, {
      email: 'sysvar_bidder@test.com',
      role: UserRole.bidder,
    });

    adminToken = createTestJWT(admin, UserRole.admin);
    auctioneerToken = createTestJWT(auctioneer, UserRole.auctioneer);
    bidderToken = createTestJWT(bidder, UserRole.bidder);

    // Create test system variables
    await prisma.systemVariable.createMany({
      data: [
        {
          category: 'TEST_auction',
          key: 'min_bid',
          value: '50000000',
          dataType: 'number',
          description: 'Min bid amount',
        },
        {
          category: 'TEST_auction',
          key: 'max_participants',
          value: '100',
          dataType: 'number',
        },
        {
          category: 'TEST_deposit',
          key: 'min_percentage',
          value: '10',
          dataType: 'number',
        },
      ],
    });
  });

  // ============================================
  // 3.9.1 List System Variables
  // ============================================
  describe('3.9.1 List System Variables', () => {
    it('TC-3.9.1-01: Verify Admin gets all system variables', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/system-variables')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('TC-3.9.1-02: Verify get variables filtered by category', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/system-variables?category=TEST_auction')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const vars = response.body;
      expect(vars.length).toBe(2);
    });

    it('TC-3.9.1-03: Fail Bidder accessing system variables', async () => {
      await request(app.getHttpServer())
        .get('/api/system-variables')
        .set('Authorization', `Bearer ${bidderToken}`)
        .expect(403);
    });

    it('TC-3.9.1-04: Fail Auctioneer accessing system variables', async () => {
      await request(app.getHttpServer())
        .get('/api/system-variables')
        .set('Authorization', `Bearer ${auctioneerToken}`)
        .expect(403);
    });

    it('TC-3.9.1-05: Verify empty list when no variables', async () => {
      await prisma.systemVariable.deleteMany({
        where: { category: { startsWith: 'TEST' } },
      });

      const response = await request(app.getHttpServer())
        .get('/api/system-variables?category=NONEXISTENT')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  // ============================================
  // 3.9.2 Get Specific Variable
  // ============================================
  describe('3.9.2 Get Specific Variable', () => {
    it('TC-3.9.2-01: Verify get specific system variable', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/system-variables/TEST_auction/min_bid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.category).toBe('TEST_auction');
      expect(response.body.key).toBe('min_bid');
      expect(response.body.value).toBe('50000000');
    });

    it('TC-3.9.2-02: Return 404 for non-existent variable', async () => {
      await request(app.getHttpServer())
        .get('/api/system-variables/invalid/nonexistent')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('TC-3.9.2-03: Verify different dataType values', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/system-variables/TEST_auction/min_bid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.dataType).toBe('number');
    });
  });

  // ============================================
  // 3.9.3 Update System Variable
  // ============================================
  describe('3.9.3 Update System Variable', () => {
    it('TC-3.9.3-01: Verify update system variable value', async () => {
      await request(app.getHttpServer())
        .patch('/api/system-variables/TEST_auction/min_bid')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: '100000000' })
        .expect(200);

      const updated = await prisma.systemVariable.findFirst({
        where: { category: 'TEST_auction', key: 'min_bid' },
      });
      expect(updated?.value).toBe('100000000');
    });

    it('TC-3.9.3-03: Fail update non-existent variable', async () => {
      await request(app.getHttpServer())
        .patch('/api/system-variables/invalid/nonexistent')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 'test' })
        .expect(404);
    });

    it('TC-3.9.3-04: Fail Bidder updating variable', async () => {
      await request(app.getHttpServer())
        .patch('/api/system-variables/TEST_auction/min_bid')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ value: '100000000' })
        .expect(403);
    });
  });

  // ============================================
  // 3.9.4 Create System Variable
  // ============================================
  describe('3.9.4 Create System Variable', () => {
    it('TC-3.9.4-01: Verify create new system variable', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/system-variables')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          category: 'TEST_new',
          key: 'max_bid',
          value: '1000000000',
          dataType: 'number',
          description: 'Max bid amount',
        })
        .expect(201);

      const created = await prisma.systemVariable.findFirst({
        where: { category: 'TEST_new', key: 'max_bid' },
      });
      expect(created).toBeTruthy();
    });

    it('TC-3.9.4-02: Fail create duplicate variable', async () => {
      await request(app.getHttpServer())
        .post('/api/system-variables')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          category: 'TEST_auction',
          key: 'min_bid', // Already exists
          value: '100000',
          dataType: 'number',
        })
        .expect(409);
    });

    it('TC-3.9.4-03: Verify create with all dataTypes', async () => {
      // Number
      await request(app.getHttpServer())
        .post('/api/system-variables')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          category: 'TEST_types',
          key: 'number_var',
          value: '123',
          dataType: 'number',
        })
        .expect(201);

      // Boolean
      await request(app.getHttpServer())
        .post('/api/system-variables')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          category: 'TEST_types',
          key: 'bool_var',
          value: 'true',
          dataType: 'boolean',
        })
        .expect(201);

      // String
      await request(app.getHttpServer())
        .post('/api/system-variables')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          category: 'TEST_types',
          key: 'string_var',
          value: 'test',
          dataType: 'string',
        })
        .expect(201);
    });

    it('TC-3.9.4-04: Fail create without required fields', async () => {
      await request(app.getHttpServer())
        .post('/api/system-variables')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ key: 'missing_category', value: 'test' })
        .expect(400);
    });
  });
});
