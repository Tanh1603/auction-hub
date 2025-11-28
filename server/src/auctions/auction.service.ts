/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated';
import { CloudinaryResponse } from '../cloudinary/cloudinary-response';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { getPaginationOptions } from '../common/utils/pagination.util';
import { PrismaService } from '../prisma/prisma.service';
import { AuctionDetailDto } from './dto/auction-detail.dto';
import { AuctionQueryDto } from './dto/auction-query.dto';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { UpdateAuctionDto } from './dto/update-auction.dto';

@Injectable()
export class AuctionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService
  ) {}

  private toAuctionDetail(
    entity,
    relatedRelations: any[] = []
  ): AuctionDetailDto {
    const relatedAuctionsMap = new Map<string, any>();

    (relatedRelations ?? []).forEach((r) => {
      if (r.auctionId === entity.id) {
        relatedAuctionsMap.set(r.relatedAuction.id, r.relatedAuction);
      } else {
        relatedAuctionsMap.set(r.auction.id, r.auction);
      }
    });

    const relatedAuctions = Array.from(relatedAuctionsMap.values());

    return {
      id: entity.id,
      code: entity.code,
      name: entity.name,
      status: entity.status,
      assetType: entity.assetType,
      assetAddress: entity.assetAddress,
      assetDescription: entity.assetDescription,
      saleStartAt: entity.saleStartAt,
      saleEndAt: entity.saleEndAt,
      auctionStartAt: entity.auctionStartAt,
      auctionEndAt: entity.auctionEndAt,
      depositEndAt: entity.depositEndAt,
      startingPrice: entity.startingPrice,
      bidIncrement: entity.bidIncrement,
      depositAmountRequired: entity.depositAmountRequired,
      saleFee: entity.saleFee,
      viewTime: entity.viewtime,
      propertyOwner: entity.propertyOwner,
      images: entity.images,
      attachments: entity.attachments,
      relatedAuctions,
    };
  }

  private toCreateAuctionDto(dto: CreateAuctionDto): Prisma.AuctionCreateInput {
    return {
      name: dto.name,
      code: dto.code,
      saleStartAt: dto.saleStartAt,
      saleEndAt: dto.saleEndAt,
      saleFee: dto.saleFee,
      viewTime: dto.viewTime,
      depositEndAt: dto.depositEndAt,
      depositAmountRequired: dto.depositAmountRequired,
      auctionStartAt: dto.auctionStartAt,
      auctionEndAt: dto.auctionEndAt,
      assetDescription: dto.assetDescription,
      assetAddress: dto.assetAddress,
      validCheckInBeforeStartMinutes: dto.validCheckInBeforeStartMinutes,
      validCheckInAfterStartMinutes: dto.validCheckInAfterStartMinutes,
      startingPrice: dto.startingPrice,
      bidIncrement: dto.bidIncrement,
      assetType: dto.assetType,
      images: dto.images,
      attachments: dto.attachments,
      assetProvince: {
        connect: {
          id: dto.assetProvinceId,
        },
      },
      assetWard: {
        connect: {
          id: dto.assetWardId,
        },
      },
      // owner: {
      //   connect: {
      //     id: dto.propertyOwnerId,
      //   },
      // },
      propertyOwner: dto.propertyOwner,
    };
  }

  private toUpdateAuctionDto(dto: UpdateAuctionDto): Prisma.AuctionUpdateInput {
    return {
      ...dto,
      assetProvince: dto.assetProvinceId
        ? { connect: { id: dto.assetProvinceId } }
        : undefined,
      assetWard: dto.assetWardId
        ? { connect: { id: dto.assetWardId } }
        : undefined,
    };
  }

  // crud
  async findAll(query: AuctionQueryDto) {
    const pagination = getPaginationOptions(query);
    const now = new Date();
    let where: Prisma.AuctionWhereInput = {
      name: { contains: query.name, mode: 'insensitive' },
      assetType: query.auctionType || undefined,
      assetWardId: query.assetWardId || undefined,
      assetProvinceId: query.assetProvinceId || undefined,
    };

    if (query.status === 'completed') {
      where = { auctionStartAt: { lt: now } };
    } else if (query.status === 'now') {
      where = { auctionStartAt: { lte: now }, auctionEndAt: { gt: now } };
    } else if (query.status === 'upcoming') {
      where = { auctionStartAt: { gt: now } };
    }

    const [items, total] = await Promise.all([
      this.prisma.auction.findMany({
        where,
        ...pagination,
        select: {
          id: true,
          name: true,
          images: true,
          startingPrice: true,
          depositAmountRequired: true,
          auctionStartAt: true,
        },
      }),
      this.prisma.auction.count({ where }),
    ]);

    return {
      data: [...items],
      meta: {
        total,
        page: query.page ?? 1,
        limit: query.limit ?? 10,
        totalPages: Math.ceil(total / (query.limit ?? 10)),
      },
    };
  }

  async findOne(id: string) {
    const auction = await this.prisma.auction.findUnique({
      where: { id },
      include: {
        participants: true,
        bids: true,
      },
    });

    const relatedRelations = await this.prisma.auctionRelation.findMany({
      where: {
        OR: [{ auctionId: auction.id }, { relatedAuctionId: auction.id }],
      },
      include: {
        auction: {
          select: {
            id: true,
            name: true,
            code: true,
            images: true,
            startingPrice: true,
            depositAmountRequired: true,
            saleStartAt: true,
          },
        },
        relatedAuction: {
          select: {
            id: true,
            name: true,
            code: true,
            images: true,
            startingPrice: true,
            depositAmountRequired: true,
            saleStartAt: true,
          },
        },
      },
    });

    return {
      data: this.toAuctionDetail(auction, relatedRelations),
    };
  }

  async create(dto: CreateAuctionDto) {
    try {
      await this.prisma.$transaction(async (db) => {
        return db.auction.create({
          data: this.toCreateAuctionDto(dto),
        });
      });

      return {
        message: 'Create auction successfully!',
      };
    } catch (error) {
      await this.cloudinary.deleteMultipleFiles([
        ...((dto.images as any as CloudinaryResponse[])?.map(
          (image) => image.publicId
        ) ?? []),
        ...((dto.attachments as any as CloudinaryResponse[])?.map(
          (attachment) => attachment.publicId
        ) ?? []),
      ]);
      throw new BadRequestException(error);
    }
  }

  async update(id: string, dto: UpdateAuctionDto) {
    const existingAuction = await this.prisma.auction.findUnique({
      where: { id },
    });
    if (!existingAuction) {
      throw new NotFoundException(`Auction with ${id} not found!`);
    }

    const imagesToDelete =
      dto.images !== undefined
        ? (existingAuction.images as any as CloudinaryResponse[]).map(
            (i) => i.publicId
          )
        : [];

    const attachmentsToDelete =
      dto.attachments !== undefined
        ? (existingAuction.attachments as any as CloudinaryResponse[]).map(
            (a) => a.publicId
          )
        : [];

    try {
      await this.prisma.$transaction(async (db) => {
        return db.auction.update({
          where: { id },
          data: {
            ...this.toUpdateAuctionDto(dto),
          },
        });
      });

      await this.cloudinary.deleteMultipleFiles([
        ...imagesToDelete,
        ...attachmentsToDelete,
      ]);

      return {
        message: 'Update auction successfully!',
      };
    } catch (error) {
      await this.cloudinary.deleteMultipleFiles([
        ...((dto.images as any as CloudinaryResponse[])?.map(
          (image) => image.publicId
        ) ?? []),
        ...((dto.attachments as any as CloudinaryResponse[])?.map(
          (attachment) => attachment.publicId
        ) ?? []),
      ]);
      throw new BadRequestException(error);
    }
  }

  async remove(id: string) {
    const existingAuction = await this.prisma.auction.findUnique({
      where: { id },
    });
    if (!existingAuction) {
      throw new NotFoundException(`Auction with ${id} not found!`);
    }

    try {
      const publicIds = [
        ...((existingAuction.images as any as CloudinaryResponse[])?.map(
          (image) => image.publicId
        ) ?? []),
        ...((existingAuction.attachments as any as CloudinaryResponse[])?.map(
          (attachment) => attachment.publicId
        ) ?? []),
      ];

      await this.prisma.auction.delete({
        where: {
          id,
        },
      });

      await this.cloudinary.deleteMultipleFiles(publicIds);
      return {
        message: 'Delete auction successfully!',
      };
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  // Update Auction Relation
  async updateRelations(auctionId: string, newRelatedIds: string[]) {
    try {
      const filteredIds = newRelatedIds.filter((id) => id !== auctionId);

      await this.prisma.$transaction(async (db) => {
        // Lấy tất cả quan hệ hiện tại của auction chính
        const existingRelations = await db.auctionRelation.findMany({
          where: {
            OR: [{ auctionId }, { relatedAuctionId: auctionId }],
          },
        });

        // Tạo Set để dễ tính toán
        const existingPairs = new Set(
          existingRelations.map((r) =>
            r.auctionId < r.relatedAuctionId
              ? `${r.auctionId}_${r.relatedAuctionId}`
              : `${r.relatedAuctionId}_${r.auctionId}`
          )
        );

        const newPairs = new Set(
          filteredIds.map((id) =>
            auctionId < id ? `${auctionId}_${id}` : `${id}_${auctionId}`
          )
        );

        // Xóa các quan hệ cũ không còn trong newRelatedIds
        const toRemove = Array.from(existingPairs).filter(
          (pair) => !newPairs.has(pair)
        );
        if (toRemove.length) {
          await db.auctionRelation.deleteMany({
            where: {
              OR: toRemove.map((pair) => {
                const [a, b] = pair.split('_');
                return {
                  OR: [
                    { auctionId: a, relatedAuctionId: b },
                    { auctionId: b, relatedAuctionId: a },
                  ],
                };
              }),
            },
          });
        }

        // Thêm các quan hệ mới
        const toAdd = Array.from(newPairs).filter(
          (pair) => !existingPairs.has(pair)
        );
        if (toAdd.length) {
          await db.auctionRelation.createMany({
            data: toAdd.map((pair) => {
              const [a, b] = pair.split('_');
              return { auctionId: a, relatedAuctionId: b };
            }),
            skipDuplicates: true,
          });
        }
      });

      return {
        message: 'Update auction relations successfully!',
      };
    } catch (error) {
      throw new BadRequestException(error);
    }
  }
}
