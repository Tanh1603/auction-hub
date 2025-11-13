// TypeScript
import {
  Injectable,
  ConflictException,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { CreateRegisterToBidDto } from './dto/create-register-to-bid.dto';
import { WithdrawRegistrationDto } from './dto/withdraw-registration.dto';
import { ApproveRegistrationDto } from './dto/approve-registration.dto';
import { RejectRegistrationDto } from './dto/reject-registration.dto';
import {
  ListRegistrationsQueryDto,
  RegistrationStatus,
} from './dto/list-registrations-query.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { CurrentUserData } from '../../../common/decorators/current-user.decorator';
import type { AuctionParticipant } from '../../../../generated';

@Injectable()
export class RegisterToBidService {
  constructor(private readonly prisma: PrismaService) {}
  private readonly logger = new Logger(RegisterToBidService.name);

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
              },
            });
            return this.toDto(updated);
          }

          // already rejected and re-submit (check this BEFORE pending review)
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
              data: { submittedAt: new Date() },
            });
            return this.toDto(updated);
          }

          // pending admin review - not allowing changes
          if (
            existing.submittedAt &&
            !existing.confirmedAt &&
            !existing.rejectedAt &&
            !existing.withdrawnAt
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
   * Get all registrations for a user (admin view)
   * Returns registrations in reverse chronological order
   */
  async getRegistrationStatusOfOneUserForAdmin(userId: string) {
    const registrations = await this.prisma.auctionParticipant.findMany({
      where: { userId },
      include: { auction: true },
      orderBy: { registeredAt: 'desc' },
    });
    if (!registrations.length) {
      throw new NotFoundException('No registrations found for this user');
    }
    return registrations.map((r) => this.toDto(r));
  }

  /**
   * Approve a registration (admin/auctioneer only)
   * Sets confirmedAt timestamp, allowing user to participate in auction
   */
  async approveRegistration(dto: ApproveRegistrationDto) {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Get the participant record
        const participant = await tx.auctionParticipant.findUnique({
          where: { id: dto.participantId },
          include: { user: true, auction: true },
        });

        if (!participant) {
          throw new NotFoundException('Registration not found');
        }

        // 2. Validate state - must be in PENDING_REVIEW state
        if (!participant.submittedAt) {
          throw new BadRequestException(
            'Registration has not been submitted yet'
          );
        }

        if (participant.confirmedAt) {
          throw new ConflictException('Registration already confirmed');
        }

        if (participant.withdrawnAt) {
          throw new BadRequestException(
            'Cannot confirm a withdrawn registration'
          );
        }

        // 3. Update to confirmed state
        this.logger.log(
          `Approving registration ${dto.participantId} for user ${participant.userId}`
        );
        const updated = await tx.auctionParticipant.update({
          where: { id: dto.participantId },
          data: {
            confirmedAt: new Date(),
            rejectedAt: null,
            rejectedReason: null,
          },
        });

        return this.toDto(updated);
      });

      return result;
    } catch (err) {
      this.logger.error(
        `Failed to approve registration ${dto.participantId}`,
        (err as Error)?.stack
      );
      throw err;
    }
  }

  /**
   * Reject a registration (admin/auctioneer only)
   * Sets rejectedAt timestamp and reason
   * Users can re-apply after rejection
   */
  async rejectRegistration(dto: RejectRegistrationDto) {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Get the participant record
        const participant = await tx.auctionParticipant.findUnique({
          where: { id: dto.participantId },
          include: { user: true, auction: true },
        });

        if (!participant) {
          throw new NotFoundException('Registration not found');
        }

        // 2. Validate state - must be in PENDING_REVIEW state
        if (!participant.submittedAt) {
          throw new BadRequestException(
            'Registration has not been submitted yet'
          );
        }

        if (participant.confirmedAt) {
          throw new ConflictException(
            'Cannot reject an already confirmed registration'
          );
        }

        if (participant.withdrawnAt) {
          throw new BadRequestException(
            'Cannot reject a withdrawn registration'
          );
        }

        // 3. Update to rejected state
        this.logger.log(
          `Rejecting registration ${dto.participantId} for user ${participant.userId}`
        );
        const updated = await tx.auctionParticipant.update({
          where: { id: dto.participantId },
          data: {
            rejectedAt: new Date(),
            rejectedReason: dto.rejectionReason || 'Not specified',
            confirmedAt: null,
          },
        });

        return this.toDto(updated);
      });

      return result;
    } catch (err) {
      this.logger.error(
        `Failed to reject registration ${dto.participantId}`,
        (err as Error)?.stack
      );
      throw err;
    }
  }

  /**
   * List all registrations with pagination and filtering (admin/auctioneer only)
   * Supports filtering by status and auction
   */
  async listRegistrations(query: ListRegistrationsQueryDto) {
    const { page = 1, limit = 10, status, auctionId } = query;
    const skip = (page - 1) * limit;

    try {
      // Build where clause based on filters
      const where: any = {};

      if (auctionId) {
        where.auctionId = auctionId;
      }

      // Apply status filter
      if (status && status !== RegistrationStatus.ALL) {
        switch (status) {
          case RegistrationStatus.PENDING_REVIEW:
            where.submittedAt = { not: null };
            where.confirmedAt = null;
            where.rejectedAt = null;
            where.withdrawnAt = null;
            break;
          case RegistrationStatus.CONFIRMED:
            where.confirmedAt = { not: null };
            break;
          case RegistrationStatus.REJECTED:
            where.rejectedAt = { not: null };
            break;
          case RegistrationStatus.WITHDRAWN:
            where.withdrawnAt = { not: null };
            break;
        }
      }

      // Get total count for pagination
      const totalItems = await this.prisma.auctionParticipant.count({ where });

      // Get paginated results with user and auction info
      const registrations = await this.prisma.auctionParticipant.findMany({
        where,
        include: {
          user: {
            select: {
              email: true,
              fullName: true,
              phoneNumber: true,
            },
          },
          auction: {
            select: {
              name: true,
              code: true,
            },
          },
        },
        orderBy: [
          { submittedAt: 'desc' },
          { registeredAt: 'desc' },
        ],
        skip,
        take: limit,
      });

      const totalPages = Math.ceil(totalItems / limit);

      return {
        data: registrations.map((r) => ({
          ...this.toDto(r),
          user: {
            email: r.user.email,
            fullName: r.user.fullName,
            phoneNumber: r.user.phoneNumber,
          },
          auction: {
            name: r.auction.name,
            code: r.auction.code,
          },
        })),
        pagination: {
          currentPage: page,
          pageSize: limit,
          totalItems,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    } catch (err) {
      this.logger.error('Failed to list registrations', (err as Error)?.stack);
      throw err;
    }
  }

  /**
   * Get current state of registration based on timestamps
   * This helper derives state from the temporal model
   */
  private getCurrentState(participant: AuctionParticipant): string {
    if (participant.checkedInAt) return 'CHECKED_IN';
    if (participant.withdrawnAt) return 'WITHDRAWN';
    if (participant.confirmedAt) return 'CONFIRMED';
    if (participant.rejectedAt) return 'REJECTED';
    if (participant.submittedAt) return 'PENDING_REVIEW';
    if (participant.registeredAt) return 'REGISTERED';
    return 'UNKNOWN';
  }

  /**
   * Convert database record to DTO
   * Include derived state for convenience
   */
  private toDto = (p: AuctionParticipant) => ({
    id: p.id,
    userId: p.userId,
    auctionId: p.auctionId,
    registeredAt: p.registeredAt,
    submittedAt: p.submittedAt,
    confirmedAt: p.confirmedAt,
    rejectedAt: p.rejectedAt,
    rejectedReason: p.rejectedReason,
    checkedInAt: p.checkedInAt,
    withdrawnAt: p.withdrawnAt,
    withdrawalReason: p.withdrawalReason,
    currentState: this.getCurrentState(p),
  });
}
