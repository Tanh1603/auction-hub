import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AUCTION_QUEUE, AuctionJob } from './auction.queue';
import { PrismaService } from '../prisma/prisma.service';
import { AuctionStatus } from '../../generated';

@Processor(AUCTION_QUEUE)
export class AuctionProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job) {
    const { auctionId } = job.data;

    switch (job.name) {
      case AuctionJob.OPEN_AUCTION:
        return this.openAuction(auctionId);

      case AuctionJob.CLOSE_AUCTION:
        return this.closeAuction(auctionId);
    }
  }

  async openAuction(auctionId: string) {
    console.log('OPEN AUCTION', auctionId);

    // DB: update auction status
    // status = OPENc
    await this.prisma.auction.update({
      where: {
        id: auctionId,
      },
      data: {
        status: AuctionStatus.live,
      },
    });

    // Emit websocket
    // ws.emit('auction_opened', auctionId)
  }

  async closeAuction(auctionId: string) {
    console.log('CLOSE AUCTION', auctionId);

    // DB: status = CLOSED
    await this.prisma.auction.update({
      where: {
        id: auctionId,
      },
      data: {
        status: AuctionStatus.awaiting_result,
      },
    });
    // determine winner
    // ws.emit('auction_closed', auctionId)
  }
}
