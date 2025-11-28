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

  private toDto(entity): ArticleDto {
    return {
      id: entity.id,
      title: entity.title,
      author: entity.author,
      content: entity.content,
      image: entity.image,
      type: entity.type,
      createdAt: entity.createdAt,
      description: entity.description,
      relatedArticles: (entity.relatedFrom ?? []).map((ra) => ({
        id: ra.relatedArticle.id,
        title: ra.relatedArticle.title,
        author: ra.relatedArticle.author,
        description: ra.relatedArticle.description,
        image: ra.relatedArticle.image,
        type: ra.relatedArticle.type,
        createdAt: ra.relatedArticle.createdAt,
      })),
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
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          author: true,
          image: true,
          createdAt: true,
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
        include: {
          relatedFrom: {
            include: {
              relatedArticle: true,
            },
          },
        },
      });

      // Lấy các quan hệ 2 chiều
      // const relatedRelations = await this.prisma.articleRelation.findMany({
      //   where: {
      //     OR: [{ articleId: id }, { relatedArticleId: id }],
      //   },
      //   include: {
      //     article: true,
      //     relatedArticle: true,
      //   },
      // });

      return {
        data: this.toDto(article),
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

  async updateRelations(articleId: string, newRelatedIds: string[]) {
    try {
      // Loại bỏ self-relation
      const filteredIds = newRelatedIds.filter((id) => id !== articleId);

      await this.prisma.$transaction(async (db) => {
        // 1. Lấy quan hệ hiện tại của articleId
        const existingRelations = await db.articleRelation.findMany({
          where: { articleId },
          select: { relatedArticleId: true },
        });

        const existingIds = existingRelations.map((r) => r.relatedArticleId);

        // 2. Xóa các quan hệ không còn trong filteredIds
        const toRemove = existingIds.filter((id) => !filteredIds.includes(id));
        if (toRemove.length) {
          await db.articleRelation.deleteMany({
            where: {
              articleId,
              relatedArticleId: { in: toRemove },
            },
          });
        }

        // 3. Thêm các quan hệ mới chưa tồn tại
        const toAdd = filteredIds.filter((id) => !existingIds.includes(id));
        if (toAdd.length) {
          await db.articleRelation.createMany({
            data: toAdd.map((id) => ({ articleId, relatedArticleId: id })),
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
