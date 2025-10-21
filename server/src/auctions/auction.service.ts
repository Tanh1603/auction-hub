import { Injectable } from '@nestjs/common';
import { getPaginationOptions } from '../common/utils/pagination.util';
import { PrismaService } from '../prisma/prisma.service';
import { AuctionQueryDto } from './dto/auction-query.dto';

@Injectable()
export class AuctionService {
  constructor(private readonly db: PrismaService) {}

  async findAll(query: AuctionQueryDto) {
    const pagination = getPaginationOptions(query);
    const now = new Date();
    let where = {};

    if (query.status === 'completed') {
      where = { auctionStartAt: { lt: now } };
    } else if (query.status === 'now') {
      where = { auctionStartAt: { lte: now }, auctionEndAt: { gt: now } };
    } else if (query.status === 'upcoming') {
      where = { auctionStartAt: { gt: now } };
    }

    const [items, total] = await Promise.all([
      this.db.auction.findMany({
        where,
        ...pagination,
      }),
      this.db.auction.count({ where }),
    ]);

    console.log(items);

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
    const auction = await this.db.auction.findUnique({
      where: { id },
      include: {
        owner: true,
        attachments: true,
        images: true,
        participants: true,
        relatedFrom: {
          include: {
            relatedAuction: {
              select: {
                id: true,
                name: true,
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
    const relatedAuctions = auction.relatedFrom.map((r) => r.relatedAuction);

    delete auction.relatedFrom;
    return {
      data: {
        ...auction,
        relatedAuctions,
      },
    };
  }
}
