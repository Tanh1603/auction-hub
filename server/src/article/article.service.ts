/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated';
import { CloudinaryResponse } from '../cloudinary/cloudinary-response';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { getPaginationOptions } from '../common/utils/pagination.util';
import { PrismaService } from '../prisma/prisma.service';
import { ArticleQueryDto } from './dto/article-query.dto';
import { ArticleDto } from './dto/article.dto';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

@Injectable()
export class ArticleService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService
  ) {}

  private toDto(entity, relatedRelations: any[] = []): ArticleDto {
    const relatedArticlesMap = new Map<string, any>();

    (relatedRelations ?? []).forEach((r) => {
      if (r.articleId === entity.id) {
        relatedArticlesMap.set(r.relatedArticle.id, r.relatedArticle);
      } else {
        relatedArticlesMap.set(r.article.id, r.article);
      }
    });

    const relatedArticles = Array.from(relatedArticlesMap.values()).map(
      (a) => ({
        id: a.id,
        title: a.title,
        author: a.author,
        content: a.content,
        image: a.image,
        type: a.type,
        createdAt: a.createdAt,
        relatedArticles: undefined,
      })
    );

    return {
      id: entity.id,
      title: entity.title,
      author: entity.author,
      content: entity.content,
      image: entity.image,
      type: entity.type,
      createdAt: entity.createdAt,
      relatedArticles,
    };
  }

  async findAll(query: ArticleQueryDto) {
    const pagination = getPaginationOptions(query);
    const where: Prisma.ArticleWhereInput = {
      title: query.title
        ? { contains: query.title, mode: 'insensitive' }
        : undefined,
      type: query.type ? query.type : undefined,
    };

    const [items, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        ...pagination,
        include: {
          relatedFrom: {
            include: {
              relatedArticle: true,
            },
          },
          relatedTo: {
            include: {
              article: true,
            },
          },
        },
      }),
      this.prisma.article.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page: query.page ?? 1,
        limit: query.limit ?? 10,
        totalPages: Math.ceil(total / (query.limit ?? 10)),
      },
    };
  }

  async findOne(id: string) {
    try {
      const article = await this.prisma.article.findUniqueOrThrow({
        where: { id },
      });

      // Lấy các quan hệ 2 chiều
      const relatedRelations = await this.prisma.articleRelation.findMany({
        where: {
          OR: [{ articleId: id }, { relatedArticleId: id }],
        },
        include: {
          article: true,
          relatedArticle: true,
        },
      });

      return {
        data: this.toDto(article, relatedRelations),
      };
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  async create(createArticleDto: CreateArticleDto) {
    try {
      const article = await this.prisma.$transaction(async (db) => {
        return await db.article.create({
          data: {
            ...createArticleDto,
          },
          include: {
            relatedFrom: {
              include: {
                relatedArticle: true,
              },
            },
            relatedTo: {
              include: {
                article: true,
              },
            },
          },
        });
      });

      return {
        data: this.toDto(article),
        message: 'Create article successfully!',
      };
    } catch (error) {
      if (createArticleDto.image) {
        await this.cloudinary.deleteFile(
          (createArticleDto.image as unknown as CloudinaryResponse).publicId
        );
      }
      throw new BadRequestException(error);
    }
  }

  async update(id: string, updateArticleDto: UpdateArticleDto) {
    try {
      let oldImage: CloudinaryResponse;
      const exisitingArticle = await this.prisma.article.findUniqueOrThrow({
        where: { id },
      });

      if (exisitingArticle) {
        oldImage = exisitingArticle.image as unknown as CloudinaryResponse;
      }

      const article = await this.prisma.$transaction((db) => {
        return db.article.update({
          data: {
            ...updateArticleDto,
          },
          where: { id },
          include: {
            relatedFrom: {
              include: {
                relatedArticle: true,
              },
            },
            relatedTo: {
              include: {
                article: true,
              },
            },
          },
        });
      });

      // If Update success , delete old image
      if (exisitingArticle) {
        await this.cloudinary.deleteFile(oldImage.publicId);
      }

      return {
        data: this.toDto(article),
        message: 'Update article successfully!',
      };
    } catch (error) {
      // when error rollbacks and deletes new upload image from update dto
      if (updateArticleDto.image) {
        await this.cloudinary.deleteFile(
          (updateArticleDto.image as unknown as CloudinaryResponse).publicId
        );
      }

      throw new BadRequestException(error);
    }
  }

  // async updateRelations(articleId: string, dto: UpdateArticleRelationsDto) {
  //   const { relatedIds } = dto;

  //   try {
  //     return await this.prisma.$transaction(async (db) => {
  //       // 1. Lấy tất cả quan hệ hiện tại liên quan đến articleId (cả 2 chiều)
  //       const existingPairs = await db.articleRelation.findMany({
  //         where: {
  //           OR: relatedIds
  //             .map((rid) => [
  //               { articleId, relatedArticleId: rid },
  //               { articleId: rid, relatedArticleId: articleId },
  //             ])
  //             .flat(),
  //         },
  //       });

  //       const existingSet = new Set(
  //         existingPairs.map((e) => `${e.articleId}_${e.relatedArticleId}`)
  //       );

  //       // 2. Chuẩn bị danh sách quan hệ mới (chỉ thêm nếu chưa tồn tại)
  //       const toCreate = relatedIds
  //         .filter(
  //           (rid) =>
  //             !existingSet.has(`${articleId}_${rid}`) &&
  //             !existingSet.has(`${rid}_${articleId}`)
  //         )
  //         .map((rid) => ({ articleId, relatedArticleId: rid }));

  //       // 3. Xóa các quan hệ cũ của articleId không còn trong relatedIds
  //       if (!relatedIds || relatedIds.length === 0) {
  //         // xóa tất cả quan hệ
  //         await db.articleRelation.deleteMany({
  //           where: {
  //             OR: [{ articleId: articleId }, { relatedArticleId: articleId }],
  //           },
  //         });
  //       } else {
  //         // xóa các quan hệ không còn trong relatedIds
  //         await db.articleRelation.deleteMany({
  //           where: {
  //             articleId,
  //             NOT: { relatedArticleId: { in: relatedIds } },
  //           },
  //         });
  //       }

  //       // 4. Thêm các quan hệ mới
  //       if (toCreate.length) {
  //         await db.articleRelation.createMany({
  //           data: toCreate,
  //           skipDuplicates: true,
  //         });
  //       }

  //       // 5. Lấy lại bài viết + các quan hệ để trả về
  //       const article = await db.article.findUnique({
  //         where: { id: articleId },
  //         include: {
  //           relatedFrom: { include: { relatedArticle: true } },
  //           relatedTo: { include: { article: true } },
  //         },
  //       });

  //       return this.toDto(article); // chuyển sang ArticleDto
  //     });
  //   } catch (error) {
  //     throw new BadRequestException(error);
  //   }
  // }

  async updateRelations(articleId: string, newRelatedIds: string[]) {
    try {
      // Loại bỏ self-relation
      const filteredIds = newRelatedIds.filter((id) => id !== articleId);

      await this.prisma.$transaction(async (db) => {
        // 1. Lấy tất cả quan hệ hiện tại của article (cả hai chiều)
        const existingRelations = await db.articleRelation.findMany({
          where: {
            OR: [{ articleId }, { relatedArticleId: articleId }],
          },
        });

        // 2. Tạo cặp khóa cho quan hệ hiện tại
        const existingPairs = new Set(
          existingRelations.map((r) =>
            r.articleId < r.relatedArticleId
              ? `${r.articleId}_${r.relatedArticleId}`
              : `${r.relatedArticleId}_${r.articleId}`
          )
        );

        // 3. Tạo cặp khóa mới từ danh sách gửi lên
        const newPairs = new Set(
          filteredIds.map((id) =>
            articleId < id ? `${articleId}_${id}` : `${id}_${articleId}`
          )
        );

        // 4. Xác định các quan hệ cần xóa
        const toRemove = Array.from(existingPairs).filter(
          (pair) => !newPairs.has(pair)
        );

        if (toRemove.length) {
          await db.articleRelation.deleteMany({
            where: {
              OR: toRemove.map((pair) => {
                const [a, b] = pair.split('_');
                return {
                  OR: [
                    { articleId: a, relatedArticleId: b },
                    { articleId: b, relatedArticleId: a },
                  ],
                };
              }),
            },
          });
        }

        // 5. Xác định các quan hệ cần thêm
        const toAdd = Array.from(newPairs).filter(
          (pair) => !existingPairs.has(pair)
        );

        if (toAdd.length) {
          await db.articleRelation.createMany({
            data: toAdd.map((pair) => {
              const [a, b] = pair.split('_');
              return { articleId: a, relatedArticleId: b };
            }),
            skipDuplicates: true,
          });
        }
      });

      return {
        message: 'Update article relations successfully!',
      };
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  async remove(id: string) {
    let oldImageId: string;
    try {
      const exsitingArticle = await this.prisma.article.findUniqueOrThrow({
        where: {
          id,
        },
      });
      if (exsitingArticle) {
        oldImageId = (exsitingArticle.image as unknown as CloudinaryResponse)
          .publicId;
      }
      await this.prisma.article.delete({
        where: { id },
      });
      if (oldImageId) {
        await this.cloudinary.deleteFile(oldImageId);
      }
      return {
        message: 'Delete article successfully!',
      };
    } catch (error) {
      throw new BadRequestException(error);
    }
  }
}
