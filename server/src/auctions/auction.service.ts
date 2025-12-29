/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuctionStatus, Prisma } from '../../generated';
import { CloudinaryResponse } from '../cloudinary/cloudinary-response';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { getPaginationOptions } from '../common/utils/pagination.util';
import { PrismaService } from '../prisma/prisma.service';
import { AuctionDetailDto } from './dto/auction-detail.dto';
import { AuctionQueryDto } from './dto/auction-query.dto';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { UpdateAuctionDto } from './dto/update-auction.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { AUCTION_QUEUE, AuctionJob } from './auction.queue';
import { Queue } from 'bullmq';

@Injectable()
export class AuctionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    @InjectQueue(AUCTION_QUEUE)
    private readonly auctionQueue: Queue
  ) {}

  private toAuctionDetail(entity): AuctionDetailDto {
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
      relatedAuctions: (entity.relatedFrom ?? []).map((r) => ({
        ...r.relatedAuction,
      })),
      assetProvince: { ...entity.assetProvince },
      assetWard: { ...entity.assetWard },
    };
  }

  private toCreateAuctionDto(dto: CreateAuctionDto): Prisma.AuctionCreateInput {
    return {
      name: dto.name,
      code: dto.code,
      saleStartAt: dto.saleStartAt,
      saleEndAt: dto.saleEndAt,
      saleFee: dto.saleFee,
      dossierFee: dto.saleFee,
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
      propertyOwner: dto.propertyOwner,
    };
  }

  private toUpdateAuctionDto(dto: UpdateAuctionDto): Prisma.AuctionUpdateInput {
    const { assetWardId, assetProvinceId, ...rest } = dto;

    return {
      ...rest,
      assetProvince: assetProvinceId
        ? { connect: { id: assetProvinceId } }
        : undefined,
      assetWard: assetWardId ? { connect: { id: assetWardId } } : undefined,
      dossierFee: dto.saleFee ? dto.saleFee : undefined,
    };
  }

  // crud
  async findAll(query: AuctionQueryDto) {
    const pagination = getPaginationOptions(query);
    // const now = new Date();
    const where: Prisma.AuctionWhereInput = {
      name: { contains: query.name, mode: 'insensitive' },
      assetType: query.auctionType || undefined,
      assetWardId: query.assetWardId || undefined,
      assetProvinceId: query.assetProvinceId || undefined,
    };

    // if (query.status === 'completed') {
    //   where = { auctionStartAt: { lt: now } };
    // } else if (query.status === 'now') {
    //   where = { auctionStartAt: { lte: now }, auctionEndAt: { gt: now } };
    // } else if (query.status === 'upcoming') {
    //   where = { auctionStartAt: { gt: now } };
    // }

    if (query.status === 'upcoming') {
      where.status = AuctionStatus.scheduled;
    } else if (query.status === 'now') {
      where.status = AuctionStatus.live;
    } else if (query.status === 'completed') {
      where.status = {
        in: [
          AuctionStatus.awaiting_result,
          AuctionStatus.success,
          AuctionStatus.failed,
        ],
      };
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
        relatedFrom: {
          include: {
            relatedAuction: {
              select: {
                id: true,
                name: true,
                images: true,
                startingPrice: true,
                depositAmountRequired: true,
                saleStartAt: true,
              },
            },
          },
        },
        assetProvince: {
          select: {
            id: true,
            name: true,
            value: true,
            sortOrder: true,
          },
        },
        assetWard: {
          select: {
            id: true,
            name: true,
            value: true,
            sortOrder: true,
          },
        },
      },
    });

    if (!auction) {
      throw new NotFoundException(`Auction with ID ${id} not found`);
    }

    return {
      data: this.toAuctionDetail(auction),
    };
  }

  async create(dto: CreateAuctionDto) {
    try {
      const now = new Date();

      const auction = await this.prisma.$transaction(async (db) => {
        return db.auction.create({
          data: this.toCreateAuctionDto(dto),
        });
      });

      // Schedule OPEN
      await this.auctionQueue.add(
        AuctionJob.OPEN_AUCTION,
        { auctionId: auction.id },
        {
          delay: auction.auctionStartAt.getTime() - now.getTime(),
          jobId: `open-${auction.id}`,
          attempts: 3,
          backoff: 5000,
          removeOnComplete: true,
          removeOnFail: true,
        }
      );

      // Schedule CLOSE
      await this.auctionQueue.add(
        AuctionJob.CLOSE_AUCTION,
        { auctionId: auction.id },
        {
          delay: auction.auctionEndAt.getTime() - now.getTime(),
          jobId: `close-${auction.id}`,
          attempts: 3,
          backoff: 5000,
          removeOnComplete: true,
          removeOnFail: true,
        }
      );

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

    if (existingAuction.status !== 'scheduled') {
      throw new BadRequestException(
        `Auction can only be deleted when its status is "scheduled".`
      );
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

  async updateRelations(auctionId: string, newRelatedIds: string[]) {
    try {
      const filteredIds = newRelatedIds.filter((id) => id !== auctionId);

      await this.prisma.$transaction(async (db) => {
        // 1. Lấy quan hệ hiện tại của auctionId
        const existingRelations = await db.auctionRelation.findMany({
          where: {
            auctionId: auctionId,
          },
          select: {
            relatedAuctionId: true,
          },
        });

        const existingIds = existingRelations.map((r) => r.relatedAuctionId);

        // 2. Xóa các quan hệ không còn trong filteredIds
        const toRemove = existingIds.filter((id) => !filteredIds.includes(id));
        if (toRemove.length) {
          await db.auctionRelation.deleteMany({
            where: {
              auctionId,
              relatedAuctionId: { in: toRemove },
            },
          });
        }

        // 3. Thêm các quan hệ mới chưa tồn tại
        const toAdd = filteredIds.filter((id) => !existingIds.includes(id));
        if (toAdd.length) {
          await db.auctionRelation.createMany({
            data: toAdd.map((id) => ({ auctionId, relatedAuctionId: id })),
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
