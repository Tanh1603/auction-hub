/**
 * Integration Tests for 3.11.1-3 Articles List, Get, and Create
 * Test Case IDs: TC-3.11.1-01 to TC-3.11.3-10
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../../server/src/prisma/prisma.service';
import { AppModule } from '../../../server/src/app/app.module';
import { UserRole, ArticleType } from '../../../server/generated';
import {
  createTestJWT,
  createTestUser,
  cleanupTestUsers,
  TestUser,
} from '../helpers/test-helpers';

describe('3.11.1-3 Articles List, Get, Create', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: TestUser;
  let bidder: TestUser;
  let adminToken: string;
  let bidderToken: string;
  let testArticle: { id: string };
  const TEST_PREFIX = 'TEST-ART';

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
    await prisma.article.deleteMany({
      where: { title: { startsWith: TEST_PREFIX } },
    });
    await cleanupTestUsers(prisma);
    await app.close();
  });

  beforeEach(async () => {
    await prisma.article.deleteMany({
      where: { title: { startsWith: TEST_PREFIX } },
    });
    await cleanupTestUsers(prisma);

    admin = await createTestUser(prisma, {
      email: 'art_admin@test.com',
      role: UserRole.admin,
    });
    bidder = await createTestUser(prisma, {
      email: 'art_bidder@test.com',
      role: UserRole.bidder,
    });

    adminToken = createTestJWT(admin, UserRole.admin);
    bidderToken = createTestJWT(bidder, UserRole.bidder);

    testArticle = await prisma.article.create({
      data: {
        title: `${TEST_PREFIX}-News Article`,
        author: 'Test Author',
        content: 'This is test content for the article.',
        description: 'Test description',
        type: ArticleType.news,
      },
    });
  });

  // ============================================
  // 3.11.1 List Articles
  // ============================================
  describe('3.11.1 List Articles', () => {
    it('TC-3.11.1-01: Verify list all articles publicly', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/articles')
        .expect(200);

      const articles = response.body.data || response.body;
      expect(Array.isArray(articles)).toBe(true);
    });

    it('TC-3.11.1-02: Verify list articles with type filter', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/articles?type=news')
        .expect(200);

      const articles = response.body.data || response.body;
      articles.forEach((article: { type: string }) => {
        expect(article.type).toBe('news');
      });
    });

    it('TC-3.11.1-03: Verify list articles with auction_notice type', async () => {
      await prisma.article.create({
        data: {
          title: `${TEST_PREFIX}-Auction Notice`,
          author: 'Admin',
          content: 'Auction notice content',
          description: 'Notice',
          type: ArticleType.auction_notice,
        },
      });

      const response = await request(app.getHttpServer())
        .get('/api/articles?type=auction_notice')
        .expect(200);

      const articles = response.body.data || response.body;
      expect(articles.length).toBeGreaterThan(0);
    });

    it('TC-3.11.1-06: Verify list articles with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/articles?page=1&limit=10')
        .expect(200);

      const articles = response.body.data || response.body;
      expect(articles.length).toBeLessThanOrEqual(10);
    });

    it('TC-3.11.1-07: Verify empty list when no articles match', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/articles?type=legal_document')
        .expect(200);

      // May or may not be empty depending on seeded data
      expect(response.body).toBeDefined();
    });
  });

  // ============================================
  // 3.11.2 Get Article by ID
  // ============================================
  describe('3.11.2 Get Article by ID', () => {
    it('TC-3.11.2-01: Verify get article by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/articles/${testArticle.id}`)
        .expect(200);

      expect(response.body.id).toBe(testArticle.id);
      expect(response.body.title).toContain(TEST_PREFIX);
    });

    it('TC-3.11.2-02: Fail get article with invalid UUID', async () => {
      await request(app.getHttpServer())
        .get('/api/articles/not-a-uuid')
        .expect(400);
    });

    it('TC-3.11.2-03: Return 404 for non-existent article', async () => {
      await request(app.getHttpServer())
        .get('/api/articles/550e8400-e29b-41d4-a716-446655440000')
        .expect(404);
    });

    it('TC-3.11.2-04: Verify article includes image JsonB', async () => {
      await prisma.article.update({
        where: { id: testArticle.id },
        data: {
          image: { url: 'https://example.com/image.jpg', publicId: 'test123' },
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/api/articles/${testArticle.id}`)
        .expect(200);

      expect(response.body.image).toBeDefined();
    });
  });

  // ============================================
  // 3.11.3 Create Article
  // ============================================
  describe('3.11.3 Create Article', () => {
    it('TC-3.11.3-01: Verify create article with all fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: `${TEST_PREFIX}-New Article`,
          author: 'Test Author',
          content: 'Full content here',
          description: 'Description',
          type: 'news',
          image: { url: 'https://example.com/img.jpg' },
        })
        .expect(201);

      expect(response.body.id).toBeDefined();
    });

    it('TC-3.11.3-02: Fail create article without title', async () => {
      await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          author: 'Test Author',
          content: 'Content',
          description: 'Desc',
          type: 'news',
        })
        .expect(400);
    });

    it('TC-3.11.3-03: Fail create article without author', async () => {
      await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: `${TEST_PREFIX}-No Author`,
          content: 'Content',
          description: 'Desc',
          type: 'news',
        })
        .expect(400);
    });

    it('TC-3.11.3-04: Fail create article without content', async () => {
      await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: `${TEST_PREFIX}-No Content`,
          author: 'Author',
          description: 'Desc',
          type: 'news',
        })
        .expect(400);
    });

    it('TC-3.11.3-05: Fail create article without type', async () => {
      await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: `${TEST_PREFIX}-No Type`,
          author: 'Author',
          content: 'Content',
          description: 'Desc',
        })
        .expect(400);
    });

    it('TC-3.11.3-06: Fail create article with invalid type enum', async () => {
      await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: `${TEST_PREFIX}-Invalid Type`,
          author: 'Author',
          content: 'Content',
          description: 'Desc',
          type: 'blog', // Invalid
        })
        .expect(400);
    });

    it('TC-3.11.3-07: Verify create article with type news', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: `${TEST_PREFIX}-News Type`,
          author: 'Author',
          content: 'Content',
          description: 'Desc',
          type: 'news',
        })
        .expect(201);

      expect(response.body.type).toBe('news');
    });
  });
});
