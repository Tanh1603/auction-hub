import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DecimalUtils } from '../../common/utils/decimal.utils';

@WebSocketGateway({
  cors: {
    origin: '*', // Configure this properly in production
  },
  namespace: '/bidding',
})
export class BiddingGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger('BiddingGateway');
  private auctionTimers: Map<string, NodeJS.Timeout> = new Map();
  private serverReady = false;

  constructor(private readonly prisma: PrismaService) {}

  afterInit() {
    this.logger.log('WebSocket Gateway initialized');
    // Wait a tick for server to be fully ready
    setTimeout(() => {
      this.serverReady = true;
      this.logger.log('WebSocket Gateway ready to accept connections');
    }, 100);
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinAuction')
  async handleJoinAuction(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { auctionId: string }
  ) {
    const auctionId = payload.auctionId;

    if (!auctionId) {
      return { event: 'error', data: { message: 'Auction ID is required' } };
    }

    try {
      // Get current auction state with winning bid
      const auctionState = await this.getAuctionState(auctionId);

      if (!auctionState) {
        return { event: 'error', data: { message: 'Auction not found' } };
      }

      // Join the auction room
      client.join(`auction:${auctionId}`);
      this.logger.log(`Client ${client.id} joined auction ${auctionId}`);

      // Send current auction state to the client
      client.emit('auctionState', auctionState);

      // Start periodic updates for this auction if not already running
      this.startAuctionUpdates(auctionId);

      return {
        event: 'joinedAuction',
        data: {
          auctionId,
          message: 'Successfully joined auction',
        },
      };
    } catch (error) {
      this.logger.error(`Error joining auction ${auctionId}:`, error);
      return {
        event: 'error',
        data: { message: 'Failed to join auction' },
      };
    }
  }

  @SubscribeMessage('leaveAuction')
  handleLeaveAuction(client: Socket, auctionId: string) {
    client.leave(`auction:${auctionId}`);
    this.logger.log(`Client ${client.id} left auction ${auctionId}`);
    return { event: 'leftAuction', data: { auctionId } };
  }

  // Method to emit new bid events
  emitNewBid(auctionId: string, bidData: Record<string, unknown>) {
    this.server.to(`auction:${auctionId}`).emit('newBid', bidData);
    this.logger.log(`New bid emitted for auction ${auctionId}`);
  }

  // Method to emit bid denied events
  emitBidDenied(auctionId: string, bidData: Record<string, unknown>) {
    this.server.to(`auction:${auctionId}`).emit('bidDenied', bidData);
    this.logger.log(`Bid denied event emitted for auction ${auctionId}`);
  }

  // Method to emit auction status updates
  emitAuctionUpdate(auctionId: string, updateData: Record<string, unknown>) {
    this.server.to(`auction:${auctionId}`).emit('auctionUpdate', updateData);
    this.logger.log(`Auction update emitted for auction ${auctionId}`);
  }

  /**
   * Get current auction state including winning bid, participants, and time remaining
   */
  private async getAuctionState(auctionId: string) {
    try {
      const auction = await this.prisma.auction.findUnique({
        where: { id: auctionId },
        include: {
          bids: {
            where: { isDenied: false, isWithdrawn: false },
            orderBy: { amount: 'desc' },
            take: 10, // Get top 10 bids for bid history
            include: {
              participant: {
                include: {
                  user: {
                    select: {
                      id: true,
                      fullName: true,
                    },
                  },
                },
              },
            },
          },
          participants: {
            where: {
              confirmedAt: { not: null },
              withdrawnAt: null,
            },
          },
        },
      });

      if (!auction) {
        return null;
      }

      const now = new Date();
      const timeRemaining = auction.auctionEndAt.getTime() - now.getTime();
      const hasStarted = now >= auction.auctionStartAt;
      const hasEnded = now > auction.auctionEndAt;

      // Get winning bid (highest valid bid)
      const winningBid = auction.bids[0] || null;

      // Calculate next minimum bid using Decimal arithmetic for precision
      let nextMinimumBid = auction.startingPrice;
      if (winningBid) {
        // ✅ FIX: Use Decimal.plus() to maintain precision
        nextMinimumBid = DecimalUtils.add(
          winningBid.amount,
          auction.bidIncrement
        );
      }

      return {
        auctionId: auction.id,
        name: auction.name,
        code: auction.code,
        status: auction.status,
        startingPrice: parseFloat(auction.startingPrice.toString()),
        bidIncrement: parseFloat(auction.bidIncrement.toString()),
        reservePrice: auction.reservePrice
          ? parseFloat(auction.reservePrice.toString())
          : null,
        auctionStartAt: auction.auctionStartAt,
        auctionEndAt: auction.auctionEndAt,
        timeRemaining: Math.max(0, timeRemaining),
        hasStarted,
        hasEnded,
        isActive: auction.isActive,
        currentWinningBid: winningBid
          ? {
              bidId: winningBid.id,
              amount: parseFloat(winningBid.amount.toString()),
              bidAt: winningBid.bidAt,
              participantId: winningBid.participantId,
              bidderName: winningBid.participant.user.fullName,
              isWinningBid: winningBid.isWinningBid,
            }
          : null,
        nextMinimumBid: DecimalUtils.toNumber(nextMinimumBid), // Convert to number for JSON
        totalBids: auction.bids.length,
        totalParticipants: auction.participants.length,
        bidHistory: auction.bids.slice(0, 5).map((bid) => ({
          bidId: bid.id,
          amount: parseFloat(bid.amount.toString()),
          bidAt: bid.bidAt,
          bidderName: bid.participant.user.fullName,
        })),
      };
    } catch (error) {
      this.logger.error(`Error getting auction state for ${auctionId}:`, error);
      return null;
    }
  }

  /**
   * Start periodic updates for auction time remaining and state
   */
  private startAuctionUpdates(auctionId: string) {
    // Don't start if already running
    if (this.auctionTimers.has(auctionId)) {
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        const auctionState = await this.getAuctionState(auctionId);

        if (!auctionState) {
          this.stopAuctionUpdates(auctionId);
          return;
        }

        // Check if there are any clients in this auction room
        if (
          !this.serverReady ||
          !this.server ||
          !this.server.sockets ||
          !this.server.sockets.adapter
        ) {
          // Server not fully initialized yet, skip this update
          return;
        }

        const room = this.server.sockets.adapter.rooms.get(
          `auction:${auctionId}`
        );
        if (!room || room.size === 0) {
          this.logger.log(
            `No clients in auction ${auctionId}, stopping updates`
          );
          this.stopAuctionUpdates(auctionId);
          return;
        }

        // Stop updates if auction has ended
        if (auctionState.hasEnded) {
          this.logger.log(`Auction ${auctionId} has ended, stopping updates`);
          this.emitAuctionUpdate(auctionId, {
            type: 'AUCTION_ENDED',
            ...auctionState,
          });
          this.stopAuctionUpdates(auctionId);
          return;
        }

        // Emit time remaining update with current winning bid
        const updateData = {
          auctionId,
          timeRemaining: auctionState.timeRemaining,
          hasStarted: auctionState.hasStarted,
          hasEnded: auctionState.hasEnded,
          // Include current winning bid (winner price) in every update
          currentWinningBid: auctionState.currentWinningBid,
          nextMinimumBid: auctionState.nextMinimumBid,
          totalBids: auctionState.totalBids,
        };

        this.server.to(`auction:${auctionId}`).emit('timeUpdate', {
          event: 'timeUpdate',
          data: updateData,
        });

        // Debug log every 5 seconds
        if (Math.floor(auctionState.timeRemaining / 1000) % 5 === 0) {
          this.logger.debug(
            `Sent timeUpdate to ${room.size} clients in auction ${auctionId}`
          );
        }
      } catch (error) {
        this.logger.error(
          `Error in auction update loop for ${auctionId}:`,
          error
        );
      }
    }, 1000); // Update every second

    this.auctionTimers.set(auctionId, intervalId);
    this.logger.log(`Started periodic updates for auction ${auctionId}`);
  }

  /**
   * Stop periodic updates for an auction
   */
  private stopAuctionUpdates(auctionId: string) {
    const intervalId = this.auctionTimers.get(auctionId);
    if (intervalId) {
      clearInterval(intervalId);
      this.auctionTimers.delete(auctionId);
      this.logger.log(`Stopped periodic updates for auction ${auctionId}`);
    }
  }

  /**
   * Enhanced method to emit new bid with full auction state
   */
  async emitNewBidWithState(auctionId: string) {
    const auctionState = await this.getAuctionState(auctionId);
    if (auctionState) {
      this.server.to(`auction:${auctionId}`).emit('newBid', auctionState);
    }
  }

  /**
   * Broadcast message to specific auction room
   */
  broadcastToAuction(
    auctionId: string,
    event: string,
    data: Record<string, unknown>
  ) {
    this.server.to(`auction:${auctionId}`).emit(event, data);
  }
}
