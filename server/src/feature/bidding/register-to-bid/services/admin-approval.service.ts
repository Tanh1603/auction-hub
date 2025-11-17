// Admin-focused approval service
// Handles: document verification/rejection, final approval/rejection, listing registrations
import {
  Injectable,
  ConflictException,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApproveRegistrationDto } from '../dto/approve-registration.dto';
import { RejectRegistrationDto } from '../dto/reject-registration.dto';
import {
  ListRegistrationsQueryDto,
  RegistrationStatus,
} from '../dto/list-registrations-query.dto';
import { PrismaService } from '../../../../prisma/prisma.service';
import { EmailService } from '../../../../common/services/email.service';
import type { AuctionParticipant } from '../../../../../generated';

@Injectable()
export class AdminApprovalService {
  private readonly logger = new Logger(AdminApprovalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
  ) {}

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
   * @deprecated Use approveRegistrationFinal for two-tier approval system
   */
  async approveRegistration(dto: ApproveRegistrationDto) {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Get the participant record
        const participant = await tx.auctionParticipant.findUnique({
          where: { id: dto.registrationId },
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
          `Approving registration ${dto.registrationId} for user ${participant.userId}`
        );
        const updated = await tx.auctionParticipant.update({
          where: { id: dto.registrationId },
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
        `Failed to approve registration ${dto.registrationId}`,
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
          where: { id: dto.registrationId },
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
          `Rejecting registration ${dto.registrationId} for user ${participant.userId}`
        );
        const updated = await tx.auctionParticipant.update({
          where: { id: dto.registrationId },
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
        `Failed to reject registration ${dto.registrationId}`,
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
        orderBy: [{ submittedAt: 'desc' }, { registeredAt: 'desc' }],
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
   * TWO-TIER APPROVAL: Tier 1 - Verify Documents
   * Admin/Auctioneer approves the submitted documents
   */
  async verifyDocuments(registrationId: string, adminId: string) {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const participant = await tx.auctionParticipant.findUnique({
          where: { id: registrationId },
          include: {
            user: true,
            auction: {
              include: {
                auctionPolicy: {
                  include: { depositConfig: true },
                },
              },
            },
          },
        });

        if (!participant) {
          throw new NotFoundException('Registration not found');
        }

        if (!participant.submittedAt) {
          throw new BadRequestException(
            'Documents have not been submitted yet'
          );
        }

        if (participant.documentsVerifiedAt) {
          throw new ConflictException('Documents already verified');
        }

        if (participant.withdrawnAt) {
          throw new BadRequestException(
            'Cannot verify documents for withdrawn registration'
          );
        }

        // Verify documents
        const updated = await tx.auctionParticipant.update({
          where: { id: registrationId },
          data: {
            documentsVerifiedAt: new Date(),
            documentsVerifiedBy: adminId,
            documentsRejectedAt: null,
            documentsRejectedReason: null,
          },
        });

        this.logger.log(
          `Documents verified for registration ${registrationId} by admin ${adminId}`
        );

        return { updated, participant };
      });

      // After document verification, send email to user
      await this.emailService.sendDocumentsVerifiedEmail({
        recipientEmail: result.participant.user.email,
        recipientName: result.participant.user.fullName,
        auctionCode: result.participant.auction.code,
        auctionName: result.participant.auction.name,
        nextStep: 'pay_deposit',
        depositAmount: parseFloat(
          result.participant.auction.depositAmountRequired.toString()
        ).toLocaleString(),
        paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      });

      this.logger.log(
        `Documents verified email sent to ${result.participant.user.email} for registration ${registrationId}`
      );

      return this.toDto(result.updated);
    } catch (err) {
      this.logger.error(
        `Failed to verify documents for registration ${registrationId}`,
        (err as Error)?.stack
      );
      throw err;
    }
  }

  /**
   * TWO-TIER APPROVAL: Tier 1 - Reject Documents
   * Admin/Auctioneer rejects the submitted documents with a reason
   * User can re-submit after document rejection
   */
  async rejectDocuments(registrationId: string, reason: string) {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const participant = await tx.auctionParticipant.findUnique({
          where: { id: registrationId },
          include: { user: true, auction: true },
        });

        if (!participant) {
          throw new NotFoundException('Registration not found');
        }

        if (!participant.submittedAt) {
          throw new BadRequestException(
            'Documents have not been submitted yet'
          );
        }

        if (participant.confirmedAt) {
          throw new ConflictException(
            'Cannot reject documents for confirmed registration'
          );
        }

        if (participant.withdrawnAt) {
          throw new BadRequestException(
            'Cannot reject documents for withdrawn registration'
          );
        }

        const updated = await tx.auctionParticipant.update({
          where: { id: registrationId },
          data: {
            documentsRejectedAt: new Date(),
            documentsRejectedReason: reason,
            documentsVerifiedAt: null,
            documentsVerifiedBy: null,
          },
        });

        this.logger.log(
          `Documents rejected for registration ${registrationId}. Reason: ${reason}`
        );

        return this.toDto(updated);
      });

      return result;
    } catch (err) {
      this.logger.error(
        `Failed to reject documents for registration ${registrationId}`,
        (err as Error)?.stack
      );
      throw err;
    }
  }

  /**
   * TWO-TIER APPROVAL: Final Approval
   * Admin/Auctioneer gives final approval after both documents and deposit are verified
   * This replaces the old approveRegistration method but keeps backward compatibility
   */
  async approveRegistrationFinal(registrationId: string, adminId: string) {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const participant = await tx.auctionParticipant.findUnique({
          where: { id: registrationId },
          include: {
            user: true,
            auction: {
              include: {
                auctionPolicy: {
                  include: { depositConfig: true },
                },
              },
            },
          },
        });

        if (!participant) {
          throw new NotFoundException('Registration not found');
        }

        // Check if documents are verified
        if (!participant.documentsVerifiedAt) {
          throw new BadRequestException('Documents must be verified first');
        }

        // Check if deposit is required and paid
        const requiresDeposit =
          participant.auction.auctionPolicy?.depositConfig?.requiresDocuments ??
          true;
        if (requiresDeposit && !participant.depositPaidAt) {
          throw new BadRequestException(
            'Deposit must be paid before final approval'
          );
        }

        if (participant.confirmedAt) {
          throw new ConflictException('Registration already confirmed');
        }

        if (participant.withdrawnAt) {
          throw new BadRequestException(
            'Cannot confirm withdrawn registration'
          );
        }

        const updated = await tx.auctionParticipant.update({
          where: { id: registrationId },
          data: {
            confirmedAt: new Date(),
            confirmedBy: adminId,
          },
        });

        this.logger.log(
          `Registration ${registrationId} finally approved by admin ${adminId}`
        );

        return { updated, participant };
      });

      // After final approval, send email to user
      await this.emailService.sendFinalApprovalEmail({
        recipientEmail: result.participant.user.email,
        recipientName: result.participant.user.fullName,
        auctionCode: result.participant.auction.code,
        auctionName: result.participant.auction.name,
        auctionStartAt: result.participant.auction.auctionStartAt,
        canNowBid: true,
      });

      this.logger.log(
        `Final approval email sent to ${result.participant.user.email} for registration ${registrationId}`
      );

      return this.toDto(result.updated);
    } catch (err) {
      this.logger.error(
        `Failed to give final approval for registration ${registrationId}`,
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
