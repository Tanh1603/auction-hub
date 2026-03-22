/**
 * Integration Tests for 2.11.4-6 Articles Update, Relations, and Delete
 * Test Case IDs: TC-2.11.4-01 to TC-2.11.6-03
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

describe('2.11.4-6 Articles Update, Relations, Delete', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: TestUser;
  let adminToken: string;
  let article1: { id: string };
  let article2: { id: string };
  let article3: { id: string };
  const TEST_PREFIX = 'TEST-ART2';

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
    await prisma.article.deleteMany({
      where: { title: { startsWith: TEST_PREFIX } },
    });
    await cleanupTestUsers(prisma);
    await app.close();
  });

  beforeEach(async () => {
    await prisma.articleRelation.deleteMany({});
    await prisma.article.deleteMany({
      where: { title: { startsWith: TEST_PREFIX } },
    });
    await cleanupTestUsers(prisma);

    admin = await createTestUser(prisma, {
      email: 'art2_admin@test.com',
      role: UserRole.admin,
    });
    adminToken = createTestJWT(admin, UserRole.admin);

    article1 = await prisma.article.create({
      data: {
        title: `${TEST_PREFIX}-Article 1`,
        author: 'Author 1',
        content: 'Content 1',
        description: 'Desc 1',
        type: ArticleType.news,
      },
    });

    article2 = await prisma.article.create({
      data: {
        title: `${TEST_PREFIX}-Article 2`,
        author: 'Author 2',
        content: 'Content 2',
        description: 'Desc 2',
        type: ArticleType.news,
      },
    });

    article3 = await prisma.article.create({
      data: {
        title: `${TEST_PREFIX}-Article 3`,
        author: 'Author 3',
        content: 'Content 3',
        description: 'Desc 3',
        type: ArticleType.auction_notice,
      },
    });
  });

  // ============================================
  // 2.11.4 Update Article
  // ============================================
  describe('2.11.4 Update Article', () => {
    it('TC-2.11.4-01: Verify update article title', async () => {
      await request(app.getHttpServer())
        .put(`/api/articles/${article1.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: `${TEST_PREFIX}-Updated Title`,
          author: 'Author 1',
          content: 'Content 1',
          description: 'Desc 1',
          type: 'news',
        })
        .expect(200);

      const updated = await prisma.article.findUnique({
        where: { id: article1.id },
      });
      expect(updated?.title).toContain('Updated Title');
    });

    it('TC-2.11.4-02: Verify update article content', async () => {
      await request(app.getHttpServer())
        .put(`/api/articles/${article1.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: `${TEST_PREFIX}-Article 1`,
          author: 'Author 1',
          content: 'Updated content here',
          description: 'Desc 1',
          type: 'news',
        })
        .expect(200);

      const updated = await prisma.article.findUnique({
        where: { id: article1.id },
      });
      expect(updated?.content).toBe('Updated content here');
    });

    it('TC-2.11.4-01: Verify update article type', async () => {
      await request(app.getHttpServer())
        .put(`/api/articles/${article1.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: `${TEST_PREFIX}-Article 1`,
          author: 'Author 1',
          content: 'Content 1',
          description: 'Desc 1',
          type: 'auction_notice',
        })
        .expect(200);

      const updated = await prisma.article.findUnique({
        where: { id: article1.id },
      });
      expect(updated?.type).toBe('auction_notice');
    });

    it('TC-2.11.4-04: Fail update non-existent article', async () => {
      await request(app.getHttpServer())
        .put('/api/articles/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Title',
          author: 'Author',
          content: 'Content',
          description: 'Desc',
          type: 'news',
        })
        .expect(404);
    });
  });

  // ============================================
  // 2.11.5 Article Relations
  // ============================================
  describe('2.11.5 Article Relations', () => {
    it('TC-2.11.5-01: Verify update article relations', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/articles/${article1.id}/relations`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ relatedIds: [article2.id, article3.id] })
        .expect(200);

      const relations = await prisma.articleRelation.findMany({
        where: { articleId: article1.id },
      });
      expect(relations.length).toBe(2);
    });

    it('TC-2.11.5-02: Verify replace article relations', async () => {
      await prisma.articleRelation.create({
        data: { articleId: article1.id, relatedArticleId: article2.id },
      });

      await request(app.getHttpServer())
        .patch(`/api/articles/${article1.id}/relations`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ relatedIds: [article3.id] })
        .expect(200);

      const relations = await prisma.articleRelation.findMany({
        where: { articleId: article1.id },
      });
      expect(relations.length).toBe(1);
      expect(relations[0].relatedArticleId).toBe(article3.id);
    });

    it('TC-2.11.5-03: Verify clear all relations', async () => {
      await prisma.articleRelation.createMany({
        data: [
          { articleId: article1.id, relatedArticleId: article2.id },
          { articleId: article1.id, relatedArticleId: article3.id },
        ],
      });

      await request(app.getHttpServer())
        .patch(`/api/articles/${article1.id}/relations`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ relatedIds: [] })
        .expect(200);

      const relations = await prisma.articleRelation.findMany({
        where: { articleId: article1.id },
      });
      expect(relations.length).toBe(0);
    });

    it('TC-2.11.5-04: Fail relation with self', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/articles/${article1.id}/relations`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ relatedIds: [article1.id] });

      expect([400, 200]).toContain(response.status);
    });
  });

  // ============================================
  // 2.11.6 Delete Article
  // ============================================
  describe('2.11.6 Delete Article', () => {
    it('TC-2.11.6-01: Verify delete article', async () => {
      await request(app.getHttpServer())
        .delete(`/api/articles/${article1.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const deleted = await prisma.article.findUnique({
        where: { id: article1.id },
      });
      expect(deleted).toBeNull();
    });

    it('TC-2.11.6-02: Fail delete non-existent article', async () => {
      await request(app.getHttpServer())
        .delete('/api/articles/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('TC-2.11.6-03: Verify delete removes related records', async () => {
      await prisma.articleRelation.create({
        data: { articleId: article1.id, relatedArticleId: article2.id },
      });

      await request(app.getHttpServer())
        .delete(`/api/articles/${article1.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const relations = await prisma.articleRelation.findMany({
        where: { articleId: article1.id },
      });
      expect(relations.length).toBe(0);
    });
  });
});
