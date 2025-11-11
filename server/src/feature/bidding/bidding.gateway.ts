import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*', // Configure this properly in production
  },
  namespace: '/bidding',
})
export class BiddingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('BiddingGateway');

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinAuction')
  handleJoinAuction(client: Socket, auctionId: string) {
    client.join(`auction:${auctionId}`);
    this.logger.log(`Client ${client.id} joined auction ${auctionId}`);
    return { event: 'joinedAuction', data: { auctionId } };
  }

  @SubscribeMessage('leaveAuction')
  handleLeaveAuction(client: Socket, auctionId: string) {
    client.leave(`auction:${auctionId}`);
    this.logger.log(`Client ${client.id} left auction ${auctionId}`);
    return { event: 'leftAuction', data: { auctionId } };
  }

  // Method to emit new bid events
  emitNewBid(auctionId: string, bidData: any) {
    this.server.to(`auction:${auctionId}`).emit('newBid', {
      event: 'newBid',
      data: bidData,
    });
    this.logger.log(`New bid emitted for auction ${auctionId}`);
  }

  // Method to emit bid denied events
  emitBidDenied(auctionId: string, bidData: any) {
    this.server.to(`auction:${auctionId}`).emit('bidDenied', {
      event: 'bidDenied',
      data: bidData,
    });
    this.logger.log(`Bid denied event emitted for auction ${auctionId}`);
  }

  // Method to emit auction status updates
  emitAuctionUpdate(auctionId: string, updateData: any) {
    this.server.to(`auction:${auctionId}`).emit('auctionUpdate', {
      event: 'auctionUpdate',
      data: updateData,
    });
    this.logger.log(`Auction update emitted for auction ${auctionId}`);
  }
}
