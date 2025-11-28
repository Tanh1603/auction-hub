/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated';
import { CloudinaryResponse } from '../cloudinary/cloudinary-response';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { getPaginationOptions } from '../common/utils/pagination.util';
import { PrismaService } from '../prisma/prisma.service';
import { AuctionDetailDto } from './dto/auction-detail.dto';
import { AuctionQueryDto } from './dto/auction-query.dto';
import { AttachmentDto, CreateAuctionDto } from './dto/create-auction.dto';
import { UpdateAuctionDto } from './dto/update-auction.dto';

@Injectable()
export class AuctionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService
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
      owner: {
        id: entity.owner.id,
        fullName: entity.owner.fullName,
        email: entity.owner.email,
        avatarUrl: entity.owner.avatarUrl,
      },
      images: entity.images,
      attachments: entity.attachments,
      relatedAuctions: entity.relatedFrom.map((r) => ({
        ...r.relatedAuction,
      })),
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
      owner: {
        connect: {
          id: dto.propertyOwnerId,
        },
      },
    };
  }

  private toUpdateAuctionDto(dto: UpdateAuctionDto): Prisma.AuctionUpdateInput {
    return {
      ...dto,
      owner: dto.propertyOwnerId
        ? {
            connect: {
              id: dto.propertyOwnerId,
            },
          }
        : undefined,
    };
  }

  // crud
  async findAll(query: AuctionQueryDto) {
    const pagination = getPaginationOptions(query);
    const now = new Date();
    let where: Prisma.AuctionWhereInput = {};

    if (query.status === 'completed') {
      where = { auctionStartAt: { lt: now } };
    } else if (query.status === 'now') {
      where = { auctionStartAt: { lte: now }, auctionEndAt: { gt: now } };
    } else if (query.status === 'upcoming') {
      where = { auctionStartAt: { gt: now } };
    }

    if (typeof query.active === 'boolean') {
      where.isActive = query.active;
    }

    const [items, total] = await Promise.all([
      this.prisma.auction.findMany({
        where,
        ...pagination,
      }),
      this.prisma.auction.count({ where }),
    ]);

    return {
      data: items.map((auction) => ({
        id: auction.id,
        name: auction.name,
        startingPrice: auction.startingPrice,
        depositAmountRequired: auction.depositAmountRequired,
        auctionStartAt: auction.auctionStartAt,
      })),
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
        owner: true,
        participants: true,
        relatedFrom: {
          include: {
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
        },
        bids: true,
      },
    });

    return {
      data: this.toAuctionDetail(auction),
    };
  }

  async create(dto: CreateAuctionDto) {
    try {
      const auction = await this.prisma.$transaction(async (db) => {
        return db.auction.create({
          data: this.toCreateAuctionDto(dto),
          include: {
            owner: true,
            relatedFrom: true,
          },
        });
      });

      return {
        data: this.toAuctionDetail(auction),
        message: 'Create auction successfully!',
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateAuctionDto) {
    const existingAuction = this.prisma.auction.findUnique({
      where: { id },
    });
    if (!existingAuction) {
      throw new NotFoundException(`Auction with ${id} not found!`);
    }

    const updatedAuction = await this.prisma.$transaction(async (db) => {
      return db.auction.update({
        where: { id },
        data: {
          ...this.toUpdateAuctionDto(dto),
        },
        include: {
          owner: true,
          relatedFrom: true,
        },
      });
    });

    return {
      data: this.toAuctionDetail(updatedAuction),
      message: 'Update auction successfully!',
    };
  }

  async updateResource(
    id: string,
    imageFiles: Express.Multer.File[],
    attachmentFiles: Express.Multer.File[]
  ) {
    let uploadImages: CloudinaryResponse[] = [];
    let uploadAttachments: AttachmentDto[] = [];

    try {
      const existingAuction = this.prisma.auction.findUnique({
        where: { id },
      });
      if (!existingAuction) {
        throw new NotFoundException(`Auction with ${id} not found!`);
      }

      [uploadImages, uploadAttachments] = await Promise.all([
        this.cloudinary.uploadFiles(imageFiles),
        this.cloudinary.uploadFiles(attachmentFiles),
      ]);

      const auction = await this.prisma.$transaction(async (db) => {
        return db.auction.update({
          where: {
            id,
          },
          include: {
            owner: true,
            relatedFrom: true,
          },
          data: {
            images: uploadImages as any,
            attachments: uploadAttachments as any,
          },
        });
      });

      return {
        data: this.toAuctionDetail(auction),
        message: 'Updated resource successfully!',
      };
    } catch (error) {
      console.log(error);

      const all = [...uploadImages, ...uploadAttachments];
      const publicIds = all.map((item) => item.publicId);
      await this.cloudinary.deleteMultipleFiles(publicIds);
      throw error;
    }
  }
}
