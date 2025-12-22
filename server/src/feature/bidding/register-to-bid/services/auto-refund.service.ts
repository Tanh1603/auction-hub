/**
 * AutoRefundService - Scheduled job for automatic deposit refunds
 * Processes refunds for non-winners 3 business days after auction finalization
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../../prisma/prisma.service';
import { RefundService, RefundStatus } from './refund.service';

@Injectable()
export class AutoRefundService {
  private readonly logger = new Logger(AutoRefundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly refundService: RefundService
  ) {}

  /**
   * Calculate business days (excluding weekends)
   * Returns the date N business days ago from now
   */
  private getBusinessDaysAgo(days: number): Date {
    const result = new Date();
    let count = 0;

    while (count < days) {
      result.setDate(result.getDate() - 1);
      const dayOfWeek = result.getDay();
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
    }

    // Set to start of day for consistent comparison
    result.setHours(0, 0, 0, 0);
    return result;
  }

  /**
   * Daily scheduled job to process automatic refunds
   * Runs every day at 6:00 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async processAutomaticRefunds(): Promise<void> {
    this.logger.log('Starting automatic refund processing...');

    try {
      // Get the cutoff date (3 business days ago)
      const cutoffDate = this.getBusinessDaysAgo(3);
      this.logger.log(
        `Processing refunds for auctions finalized before: ${cutoffDate.toISOString()}`
      );

      // Find finalized auctions that are at least 3 business days old
      const eligibleAuctions = await this.prisma.auction.findMany({
        where: {
          status: { in: ['success', 'failed'] },
          updatedAt: { lte: cutoffDate },
        },
        select: { id: true, code: true, name: true },
      });

      this.logger.log(
        `Found ${eligibleAuctions.length} auctions eligible for auto-refund processing`
      );

      let totalProcessed = 0;
      let totalSkipped = 0;
      let totalErrors = 0;

      for (const auction of eligibleAuctions) {
        const result = await this.processAuctionRefunds(auction.id);
        totalProcessed += result.processed;
        totalSkipped += result.skipped;
        totalErrors += result.errors;
      }

      this.logger.log(
        `Auto-refund job completed. Processed: ${totalProcessed}, Skipped: ${totalSkipped}, Errors: ${totalErrors}`
      );
    } catch (error) {
      this.logger.error('Auto-refund job failed:', error);
    }
  }

  /**
   * Process refunds for a single auction
   */
  async processAuctionRefunds(auctionId: string): Promise<{
    processed: number;
    skipped: number;
    errors: number;
  }> {
    let processed = 0;
    let skipped = 0;
    let errors = 0;

    try {
      // Find eligible participants for auto-refund
      const participants = await this.prisma.auctionParticipant.findMany({
        where: {
          auctionId,
          depositPaidAt: { not: null }, // Has paid deposit
          isDisqualified: false, // Not disqualified
          refundStatus: {
            notIn: [
              RefundStatus.PROCESSED,
              RefundStatus.FORFEITED,
              RefundStatus.AUTO_PROCESSED,
            ],
          },
          // Not a winning bid holder
          bids: { none: { isWinningBid: true, isWithdrawn: false } },
        },
        include: {
          user: { select: { email: true, fullName: true } },
          auction: { select: { code: true, name: true, saleEndAt: true } },
        },
      });

      for (const participant of participants) {
        try {
          // Check withdrawal deadline compliance
          if (participant.withdrawnAt) {
            const withdrawalDeadline = participant.auction.saleEndAt;
            if (
              withdrawalDeadline &&
              participant.withdrawnAt > withdrawalDeadline
            ) {
              // Withdrew after deadline - forfeit deposit
              await this.prisma.auctionParticipant.update({
                where: { id: participant.id },
                data: {
                  refundStatus: RefundStatus.FORFEITED,
                  isDisqualified: true,
                  disqualifiedAt: new Date(),
                  disqualifiedReason: 'LATE_WITHDRAWAL',
                },
              });
              skipped++;
              continue;
            }
          }

          // Check check-in status (if auction was successful, participant should have checked in)
          const auction = await this.prisma.auction.findUnique({
            where: { id: auctionId },
          });
          if (
            auction?.status === 'success' &&
            !participant.checkedInAt &&
            !participant.withdrawnAt
          ) {
            // Didn't check in and didn't withdraw - forfeit
            await this.prisma.auctionParticipant.update({
              where: { id: participant.id },
              data: {
                refundStatus: RefundStatus.FORFEITED,
                isDisqualified: true,
                disqualifiedAt: new Date(),
                disqualifiedReason: 'CHECK_IN_FAILURE',
              },
            });
            skipped++;
            continue;
          }

          // Process auto-refund
          await this.prisma.auctionParticipant.update({
            where: { id: participant.id },
            data: {
              refundStatus: RefundStatus.AUTO_PROCESSED,
              refundProcessedAt: new Date(),
            },
          });

          // TODO: Integrate with actual payment refund (Stripe)
          // await this.refundService.executeRefund(participant.id, 'system');

          // Send notification email
          await this.refundService.notifyUserOfRefundProcessed({
            user: {
              email: participant.user.email,
              fullName: participant.user.fullName,
            },
            auction: {
              code: participant.auction.code,
              name: participant.auction.name || '',
            },
            depositAmount: participant.depositAmount,
          });

          processed++;
          this.logger.log(
            `Auto-refund processed for participant ${participant.id}`
          );
        } catch (participantError) {
          this.logger.error(
            `Error processing refund for participant ${participant.id}:`,
            participantError
          );
          errors++;
        }
      }
    } catch (error) {
      this.logger.error(`Error processing auction ${auctionId}:`, error);
      errors++;
    }

    return { processed, skipped, errors };
  }

  /**
   * Manually trigger auto-refund processing for testing/admin use
   */
  async triggerManualProcessing(auctionId?: string): Promise<{
    processed: number;
    skipped: number;
    errors: number;
  }> {
    this.logger.log('Manual auto-refund processing triggered');

    if (auctionId) {
      return this.processAuctionRefunds(auctionId);
    }

    // Process all eligible auctions
    await this.processAutomaticRefunds();
    return { processed: 0, skipped: 0, errors: 0 }; // Stats logged in job
  }
}
