// User-focused registration service
// Handles: registration creation, document submission, withdrawal, check-in
import {
  Injectable,
  ConflictException,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { CreateRegisterToBidDto } from '../dto/create-register-to-bid.dto';
import { WithdrawRegistrationDto } from '../dto/withdraw-registration.dto';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CurrentUserData } from '../../../../common/decorators/current-user.decorator';
import type { AuctionParticipant } from '../../../../../generated';

@Injectable()
export class UserRegistrationService {
  private readonly logger = new Logger(UserRegistrationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create or resubmit registration for an auction
   * Temporal state model:
   * - registeredAt: set when user initiates
   * - submittedAt: set when documents submitted
   * - confirmedAt: set when admin approves
   * - rejectedAt: set when admin rejects
   * - withdrawnAt: set when user withdraws
   */
  async create(dto: CreateRegisterToBidDto, currentUser: CurrentUserData) {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. verify user exists and get full user data from database
        const dbUser = await tx.user.findUnique({
          where: { id: currentUser.id },
        });
        if (!dbUser) {
          this.logger.warn('User not found');
          throw new NotFoundException('User not found');
        }
        if (dbUser.isBanned) {
          this.logger.warn('User already banned');
          throw new ForbiddenException('User already banned');
        }
        if (dbUser.deletedAt) {
          this.logger.warn('User deleted');
          throw new ForbiddenException('User deleted');
        }

        // 2. validate auction exists and is open to register
        const auction = await tx.auction.findUnique({
          where: { id: dto.auctionId },
        });
        if (!auction) {
          throw new NotFoundException('Auction not found');
        }

        const now = new Date();
        if (now > auction.saleEndAt) {
          throw new ForbiddenException('Auction registration period has ended');
        }
        if (now < auction.saleStartAt) {
          throw new BadRequestException(
            'Auction registration period is not open yet'
          );
        }

        // 3. get existing participation (if any)
        const existing = await tx.auctionParticipant.findUnique({
          where: {
            auctionId_userId: {
              auctionId: dto.auctionId,
              userId: currentUser.id,
            },
          },
        });

        // Prepare document URLs as JSON
        const documentUrls = dto.documentUrls
          ? JSON.stringify(dto.documentUrls)
          : null;

        // 4. state machine for existing participant
        if (existing) {
          // already confirmed
          if (existing.confirmedAt) {
            this.logger.warn('User already confirmed');
            throw new ConflictException('User already confirmed');
          }

          // already withdrawn - allow re-applying (check this BEFORE pending review)
          if (existing.withdrawnAt) {
            this.logger.log(
              `User ${currentUser.id} re-registering after withdrawal for auction ${dto.auctionId}`
            );
            const updated = await tx.auctionParticipant.update({
              where: { id: existing.id },
              data: {
                withdrawnAt: null,
                withdrawalReason: null,
                submittedAt: new Date(),
                documentUrls,
                documentsRejectedAt: null,
                documentsRejectedReason: null,
              },
            });
            return this.toDto(updated);
          }

          // documents rejected - allow re-submitting with new documents
          if (existing.documentsRejectedAt) {
            this.logger.log(
              `User ${currentUser.id} re-submitting documents after rejection for auction ${dto.auctionId}`
            );
            const updated = await tx.auctionParticipant.update({
              where: { id: existing.id },
              data: {
                documentsRejectedAt: null,
                documentsRejectedReason: null,
                submittedAt: new Date(),
                documentUrls,
              },
            });
            return this.toDto(updated);
          }

          // already rejected (legacy) and re-submit
          if (existing.rejectedAt) {
            this.logger.log(
              `User ${currentUser.id} re-applying after rejection for auction ${dto.auctionId}`
            );
            const updated = await tx.auctionParticipant.update({
              where: { id: existing.id },
              data: {
                rejectedAt: null,
                rejectedReason: null,
                submittedAt: new Date(),
                documentUrls,
              },
            });
            return this.toDto(updated);
          }

          // pending submission - update document and resubmit
          if (
            existing.registeredAt &&
            !existing.submittedAt &&
            !existing.rejectedAt
          ) {
            this.logger.warn(`User ${currentUser.id} resubmitting for auction`);
            const updated = await tx.auctionParticipant.update({
              where: { id: existing.id },
              data: {
                submittedAt: new Date(),
                documentUrls,
              },
            });
            return this.toDto(updated);
          }

          // pending admin review - not allowing changes
          if (
            existing.submittedAt &&
            !existing.confirmedAt &&
            !existing.rejectedAt &&
            !existing.withdrawnAt &&
            !existing.documentsRejectedAt
          ) {
            this.logger.warn(
              'User is pending for admin review, not allowing changes'
            );
            throw new ConflictException(
              'Your registration is under review. Please wait for decision'
            );
          }

          // fallback: return current participant state
          return this.toDto(existing);
        }

        // fresh registration - create new participant record
        this.logger.log(
          `Creating new registration for user ${currentUser.id} in auction ${dto.auctionId}`
        );
        const created = await tx.auctionParticipant.create({
          data: {
            userId: currentUser.id,
            auctionId: dto.auctionId,
            registeredAt: new Date(),
            submittedAt: new Date(), // immediately submit documents
            documentUrls,
          },
        });
        return this.toDto(created);
      });

      return result;
    } catch (err) {
      this.logger.error(
        `Registration failed for user ${currentUser?.id}, auction ${dto?.auctionId}`,
        (err as Error)?.stack
      );
      throw err;
    }
  }

  /**
   * Withdraw user's registration from an auction
   * Allows participants to cancel their registration before auction starts
   */
  async withdraw(dto: WithdrawRegistrationDto, currentUser: CurrentUserData) {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. verify user exists
        const dbUser = await tx.user.findUnique({
          where: { id: currentUser.id },
        });
        if (!dbUser) {
          throw new NotFoundException('User not found');
        }
        if (dbUser.isBanned) {
          throw new ForbiddenException('User is banned');
        }
        if (dbUser.deletedAt) {
          throw new ForbiddenException('User account is deleted');
        }

        // 2. verify auction exists
        const auction = await tx.auction.findUnique({
          where: { id: dto.auctionId },
        });
        if (!auction) {
          throw new NotFoundException('Auction not found');
        }

        // 3. get existing participation
        const participant = await tx.auctionParticipant.findUnique({
          where: {
            auctionId_userId: {
              auctionId: dto.auctionId,
              userId: currentUser.id,
            },
          },
        });

        if (!participant) {
          throw new NotFoundException('No registration found for this auction');
        }

        // 4. validate withdrawal eligibility
        if (participant.withdrawnAt) {
          throw new ConflictException('Registration already withdrawn');
        }

        if (!participant.registeredAt) {
          throw new BadRequestException('Invalid registration state');
        }

        // Cannot withdraw if auction has already started
        const now = new Date();
        if (now >= auction.auctionStartAt) {
          throw new ForbiddenException(
            'Cannot withdraw after auction has started'
          );
        }

        // Cannot withdraw if already checked in
        if (participant.checkedInAt) {
          throw new ForbiddenException(
            'Cannot withdraw after checking in to the auction'
          );
        }

        // 5. perform withdrawal
        this.logger.log(
          `User ${currentUser.id} withdrawing from auction ${dto.auctionId}`
        );
        const updated = await tx.auctionParticipant.update({
          where: { id: participant.id },
          data: {
            withdrawnAt: new Date(),
            withdrawalReason: dto.withdrawalReason,
          },
        });

        return this.toDto(updated);
      });

      return result;
    } catch (err) {
      this.logger.error(
        `Withdrawal failed for user ${currentUser?.id}, auction ${dto?.auctionId}`,
        (err as Error)?.stack
      );
      throw err;
    }
  }

  /**
   * Check in for auction
   * Allows confirmed participants to check in before or at the start of auction
   * Check-in confirms presence and enables bidding
   */
  async checkIn(auctionId: string, userId: string) {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Validate auction exists
        const auction = await tx.auction.findUnique({
          where: { id: auctionId },
        });

        if (!auction) {
          throw new NotFoundException('Auction not found');
        }

        // 2. Get participant registration
        const participant = await tx.auctionParticipant.findUnique({
          where: {
            auctionId_userId: {
              auctionId: auctionId,
              userId: userId,
            },
          },
        });

        if (!participant) {
          throw new NotFoundException(
            'You are not registered for this auction'
          );
        }

        // 3. Validate registration state
        if (!participant.confirmedAt) {
          throw new ForbiddenException(
            'Your registration must be confirmed before check-in'
          );
        }

        if (participant.rejectedAt) {
          throw new ForbiddenException(
            'Cannot check in - registration was rejected'
          );
        }

        if (participant.withdrawnAt) {
          throw new ForbiddenException(
            'Cannot check in - you have withdrawn from this auction'
          );
        }

        if (participant.checkedInAt) {
          throw new ConflictException('You have already checked in');
        }

        // 4. Validate timing - allow check-in from 24 hours before auction until auction ends
        const now = new Date();
        const checkInWindowStart = new Date(
          auction.auctionStartAt.getTime() - 24 * 60 * 60 * 1000
        ); // 24 hours before

        if (now < checkInWindowStart) {
          throw new ForbiddenException(
            'Check-in window has not opened yet. You can check in starting 24 hours before the auction.'
          );
        }

        if (now > auction.auctionEndAt) {
          throw new ForbiddenException('Auction has ended');
        }

        // 5. Perform check-in
        this.logger.log(`User ${userId} checking in for auction ${auctionId}`);

        const updated = await tx.auctionParticipant.update({
          where: { id: participant.id },
          data: {
            checkedInAt: now,
          },
        });

        return updated;
      });

      this.logger.log(
        `User ${userId} successfully checked in for auction ${auctionId}`
      );

      return this.toDto(result);
    } catch (err) {
      this.logger.error(
        `Failed to check in user ${userId} for auction ${auctionId}`,
        (err as Error)?.stack
      );
      throw err;
    }
  }

  /**
   * Get current state of registration based on timestamps
   * This helper derives state from the temporal model
   * Updated to support two-tier approval
   */
  private getCurrentState(participant: AuctionParticipant): string {
    if (participant.checkedInAt) return 'CHECKED_IN';
    if (participant.withdrawnAt) return 'WITHDRAWN';
    if (participant.confirmedAt) return 'CONFIRMED';
    if (participant.depositPaidAt) return 'DEPOSIT_PAID';
    if (participant.documentsVerifiedAt && !participant.depositPaidAt)
      return 'DOCUMENTS_VERIFIED';
    if (participant.documentsRejectedAt) return 'DOCUMENTS_REJECTED';
    if (participant.rejectedAt) return 'REJECTED';
    if (participant.submittedAt) return 'PENDING_DOCUMENT_REVIEW';
    if (participant.registeredAt) return 'REGISTERED';
    return 'UNKNOWN';
  }

  /**
   * Convert database record to DTO
   * Include derived state for convenience
   * Updated to include two-tier approval fields
   */
  private toDto = (p: AuctionParticipant) => ({
    id: p.id,
    userId: p.userId,
    auctionId: p.auctionId,

    // Registration timestamps
    registeredAt: p.registeredAt,
    submittedAt: p.submittedAt,

    // Two-tier approval: Tier 1 - Document verification
    documentsVerifiedAt: p.documentsVerifiedAt,
    documentsVerifiedBy: p.documentsVerifiedBy,
    documentsRejectedAt: p.documentsRejectedAt,
    documentsRejectedReason: p.documentsRejectedReason,
    documentUrls: p.documentUrls ? JSON.parse(p.documentUrls as string) : null,

    // Two-tier approval: Tier 2 - Deposit verification
    depositPaidAt: p.depositPaidAt,
    depositAmount: p.depositAmount
      ? parseFloat(p.depositAmount.toString())
      : null,
    depositPaymentId: p.depositPaymentId,

    // Final approval
    confirmedAt: p.confirmedAt,
    confirmedBy: p.confirmedBy,

    // Legacy rejection
    rejectedAt: p.rejectedAt,
    rejectedReason: p.rejectedReason,

    // Other states
    checkedInAt: p.checkedInAt,
    withdrawnAt: p.withdrawnAt,
    withdrawalReason: p.withdrawalReason,

    // Derived state
    currentState: this.getCurrentState(p),
  });
}
