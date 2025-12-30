import { Injectable, Logger } from '@nestjs/common';
import { AuctionEvaluationService } from './services/auction-evaluation.service';
import { AuctionOwnerService } from './services/auction-owner.service';
import { WinnerPaymentService } from './services/winner-payment.service';
import { AuctionResultsService } from './services/auction-results.service';
import { FinalizeAuctionDto } from './dto/finalize-auction.dto';
import { OverrideAuctionStatusDto } from './dto/override-auction-status.dto';
import { AuctionResultDto } from './dto/auction-result.dto';
import { EvaluationResultDto } from './dto/evaluation-result.dto';
import { ManagementDetailDto } from './dto/management-detail.dto';

/**
 * Main orchestrator service for auction finalization
 * Delegates to specialized services based on actor context:
 * - AuctionEvaluationService: System/Automated evaluation
 * - AuctionOwnerService: Auction owner/auctioneer operations
 * - WinnerPaymentService: Winner payment operations
 * - AuctionResultsService: Participant/viewer results access
 */
@Injectable()
export class AuctionFinalizationService {
  private readonly logger = new Logger(AuctionFinalizationService.name);

  constructor(
    private readonly evaluationService: AuctionEvaluationService,
    private readonly ownerService: AuctionOwnerService,
    private readonly winnerPaymentService: WinnerPaymentService,
    private readonly resultsService: AuctionResultsService
  ) {}

  /**
   * Automatically evaluate auction status based on business rules
   * Context: System/Automated Evaluation
   * Delegates to: AuctionEvaluationService
   */
  async evaluateAuction(auctionId: string): Promise<EvaluationResultDto> {
    return this.evaluationService.evaluateAuction(auctionId);
  }

  /**
   * Finalize auction with automatic evaluation
   * Context: Auction Owner/Auctioneer
   * Delegates to: AuctionOwnerService
   */
  async finalizeAuction(dto: FinalizeAuctionDto, userId: string) {
    return this.ownerService.finalizeAuction(dto, userId);
  }

  /**
   * Admin override - manually change auction status with audit trail
   * Context: Auction Owner/Auctioneer
   * Delegates to: AuctionOwnerService
   */
  async overrideAuctionStatus(dto: OverrideAuctionStatusDto, adminId: string) {
    return this.ownerService.overrideAuctionStatus(dto, adminId);
  }

  /**
   * Get auction results - PUBLIC with tiered access control
   * Context: Public/Participants/Viewers/Admin
   * Delegates to: AuctionResultsService
   */
  async getAuctionResults(
    auctionId: string,
    userId: string | null,
    userRole: string | null
  ): Promise<AuctionResultDto> {
    return this.resultsService.getAuctionResults(auctionId, userId, userRole);
  }

  /**
   * Get audit logs for an auction
   * Context: Auction Owner/Auctioneer
   * Delegates to: AuctionOwnerService
   */
  async getAuctionAuditLogs(auctionId: string, userId: string) {
    return this.ownerService.getAuctionAuditLogs(auctionId, userId);
  }

  /**
   * Get winner payment requirements
   * Context: Auction Winner
   * Delegates to: WinnerPaymentService
   */
  async getWinnerPaymentRequirements(auctionId: string) {
    return this.winnerPaymentService.getWinnerPaymentRequirements(auctionId);
  }

  /**
   * Initiate winner payment
   * Context: Auction Winner
   * Delegates to: WinnerPaymentService
   */
  async initiateWinnerPayment(auctionId: string, winnerId: string) {
    return this.winnerPaymentService.initiateWinnerPayment(auctionId, winnerId);
  }

  /**
   * Verify winner payment and prepare contract
   * Context: Auction Winner
   * Delegates to: WinnerPaymentService
   */
  async verifyWinnerPaymentAndPrepareContract(
    sessionId: string,
    auctionId: string
  ) {
    return this.winnerPaymentService.verifyWinnerPaymentAndPrepareContract(
      sessionId,
      auctionId
    );
  }

  /**
   * Verify winner payment (wrapper for session-based verification)
   * Context: Auction Winner
   * Delegates to: WinnerPaymentService
   */
  async verifyWinnerPayment(
    sessionId: string,
    auctionId: string,
    userId: string
  ) {
    return this.winnerPaymentService.verifyWinnerPayment(
      sessionId,
      auctionId,
      userId
    );
  }

  /**
   * Get management detail for admin override operations
   * Context: Admin/Super Admin
   * Delegates to: AuctionOwnerService
   */
  async getManagementDetail(
    auctionId: string,
    adminId: string
  ): Promise<ManagementDetailDto> {
    return this.ownerService.getManagementDetail(auctionId, adminId);
  }
}
