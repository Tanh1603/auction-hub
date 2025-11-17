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
import { PaymentService } from '../../../payment/payment.service';
import { PaymentProcessingService } from '../../../payment/payment-processing.service';
import { EmailService } from '../../../common/services/email.service';
import type { AuctionParticipant } from '../../../../generated';
import {
  PaymentType,
  PaymentMethod,
} from '../../../payment/dto/PaymentCreateRequest.dto';

@Injectable()
export class RegisterToBidService {
  private readonly logger = new Logger(RegisterToBidService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
    private readonly paymentProcessingService: PaymentProcessingService,
    private readonly emailService: EmailService
  ) {}

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
   * TWO-TIER APPROVAL: Tier 2 - Submit Deposit
   * User initiates deposit payment after documents are verified
   * Creates Stripe payment and returns payment URL/QR code
   */
  async submitDeposit(
    registrationId: string,
    auctionId: string,
    amount: number,
    userId: string
  ) {
    try {
      // Validate registration exists and is in correct state
      const participant = await this.prisma.auctionParticipant.findUnique({
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

      if (participant.userId !== userId) {
        throw new BadRequestException('Registration does not belong to user');
      }

      if (!participant.documentsVerifiedAt) {
        throw new BadRequestException(
          'Documents must be verified before submitting deposit'
        );
      }

      if (participant.depositPaidAt) {
        throw new ConflictException('Deposit already submitted');
      }

      if (participant.withdrawnAt) {
        throw new BadRequestException(
          'Cannot submit deposit for withdrawn registration'
        );
      }

      // Use PaymentProcessingService to create payment and handle business logic
      const paymentResult =
        await this.paymentProcessingService.processDepositPayment(
          userId,
          auctionId,
          registrationId,
          amount
        );

      this.logger.log(
        `Deposit payment initiated for registration ${registrationId}. Payment ID: ${paymentResult.paymentId}`
      );

      return paymentResult;
    } catch (err) {
      this.logger.error(
        `Failed to submit deposit for registration ${registrationId}`,
        (err as Error)?.stack
      );
      throw err;
    }
  }

  /**
   * TWO-TIER APPROVAL: Verify Deposit Payment
   * Verify Stripe payment and update registration with deposit payment details
   */
  async verifyDepositPayment(
    sessionId: string,
    registrationId: string,
    userId: string
  ) {
    try {
      // Verify the registration belongs to the user and get auction info
      const participant = await this.prisma.auctionParticipant.findUnique({
        where: { id: registrationId },
        include: {
          auction: true,
        },
      });

      if (!participant) {
        throw new NotFoundException('Registration not found');
      }

      if (participant.userId !== userId) {
        throw new BadRequestException('Registration does not belong to user');
      }

      if (participant.depositPaidAt) {
        throw new ConflictException('Deposit already verified');
      }

      // Verify payment with Stripe
      const verification = await this.paymentService.verifyPayment(sessionId);

      if (verification.status !== 'paid') {
        throw new BadRequestException('Payment not completed yet');
      }

      // CRITICAL: Verify the received amount matches the expected deposit amount
      const expectedAmount = parseFloat(
        participant.auction.depositAmountRequired.toString()
      );
      const receivedAmount = verification.amount;

      if (receivedAmount < expectedAmount) {
        // Payment amount is insufficient
        this.logger.warn(
          `Payment verification failed for ${registrationId}. Expected ${expectedAmount}, but received ${receivedAmount}`
        );
        throw new BadRequestException(
          `Payment received (${receivedAmount}) is less than the required deposit (${expectedAmount}). Please contact support.`
        );
      }

      // Find the payment record by transaction ID (Stripe session ID)
      const payment = await this.prisma.payment.findFirst({
        where: {
          transactionId: sessionId,
          registrationId: registrationId,
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment record not found');
      }

      // Update both payment and registration in a transaction
      await this.prisma.$transaction(async (tx) => {
        // Update payment status
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'completed',
            paidAt: new Date(),
          },
        });

        // Update registration with deposit info
        await tx.auctionParticipant.update({
          where: { id: registrationId },
          data: {
            depositPaidAt: new Date(),
            depositAmount: receivedAmount, // Use receivedAmount since it matches expectedAmount
            depositPaymentId: payment.id,
          },
        });
      });

      this.logger.log(
        `Deposit payment verified for registration ${registrationId}. Session ID: ${sessionId}`
      );

      return {
        verified: true,
        paymentId: payment.id,
        sessionId: sessionId,
        amount: verification.amount,
        status: 'completed',
        message:
          'Deposit payment verified successfully. Awaiting final admin approval.',
      };
    } catch (err) {
      this.logger.error(
        `Failed to verify deposit payment for registration ${registrationId}`,
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

  /**
   * INTEGRATION POINT 1a: Initiate deposit payment (Tier 2 - Step 1)
   * After documents are verified, user initiates deposit payment
   *
   * SIMPLIFIED APPROACH:
   * - Deposit amount already calculated by policy
   * - Directly invoke PaymentService.createPayment()
   */
  async initiateDepositPayment(registrationId: string, userId: string) {
    try {
      this.logger.log(
        `Initiating deposit payment for registration ${registrationId} by user ${userId}`
      );

      // Get registration with auction details
      const participant = await this.prisma.auctionParticipant.findUnique({
        where: { id: registrationId },
        include: {
          auction: true,
        },
      });

      if (!participant) {
        throw new NotFoundException('Registration not found');
      }

      if (participant.userId !== userId) {
        throw new BadRequestException('Registration does not belong to user');
      }

      if (!participant.documentsVerifiedAt) {
        throw new BadRequestException(
          'Documents must be verified before deposit payment'
        );
      }

      if (participant.depositPaidAt) {
        throw new BadRequestException('Deposit already paid');
      }

      // Deposit amount already calculated by policy and stored in auction
      const depositAmount = parseFloat(
        participant.auction.depositAmountRequired.toString()
      );

      // Directly invoke PaymentService.createPayment() - SIMPLIFIED!
      const paymentInfo = await this.paymentService.createPayment(userId, {
        auctionId: participant.auctionId,
        registrationId: registrationId,
        paymentType: PaymentType.deposit,
        amount: depositAmount,
        paymentMethod: PaymentMethod.bank_transfer,
      });

      this.logger.log(
        `Deposit payment created: ${paymentInfo.payment_id} for registration ${registrationId}. Amount: ${depositAmount}`
      );

      return {
        paymentId: paymentInfo.payment_id,
        amount: depositAmount,
        paymentUrl: paymentInfo.payment_url,
        qrCode: paymentInfo.qr_code,
        bankInfo: paymentInfo.bank_info,
        deadline: paymentInfo.payment_deadline,
        message:
          'Please complete payment within 24 hours to proceed with registration.',
      };
    } catch (err) {
      this.logger.error(
        `Failed to initiate deposit payment for registration ${registrationId}`,
        (err as Error)?.stack
      );
      throw err;
    }
  }

  /**
   * INTEGRATION POINT 1b: Verify deposit payment and update registration
   * Called after user completes payment via Stripe
   *
   * SIMPLIFIED APPROACH:
   * - Directly invoke PaymentService.verifyPayment()
   * - Update registration state after verification
   */
  async verifyAndConfirmDepositPayment(
    registrationId: string,
    paymentId: string
  ) {
    try {
      this.logger.log(
        `Verifying deposit payment ${paymentId} for registration ${registrationId}`
      );

      // Step 1: Verify payment with Stripe via PaymentService
      const verification = await this.paymentService.verifyPayment(paymentId);

      if (verification.status !== 'paid') {
        this.logger.warn(
          `Payment ${paymentId} verification failed. Status: ${verification.status}`
        );

        // Get participant with user and auction info for email
        const participant = await this.prisma.auctionParticipant.findUnique({
          where: { id: registrationId },
          include: {
            user: true,
            auction: true,
          },
        });

        if (participant) {
          // Calculate remaining time to deadline (24 hours from documents verified)
          const deadlineDate = new Date(participant.documentsVerifiedAt);
          deadlineDate.setHours(deadlineDate.getHours() + 24);
          const now = new Date();

          // Check if deadline has passed
          if (now > deadlineDate) {
            // Deadline expired - automatically reject registration
            await this.prisma.auctionParticipant.update({
              where: { id: registrationId },
              data: {
                documentsRejectedAt: new Date(),
                documentsRejectedReason:
                  'Payment deadline expired. Deposit not received within 24 hours.',
                documentsVerifiedAt: null,
                documentsVerifiedBy: null,
              },
            });

            this.logger.error(
              `Registration ${registrationId} automatically rejected due to expired payment deadline`
            );

            throw new BadRequestException(
              'Payment deadline has expired. Your registration has been cancelled. Please re-register if you still wish to participate.'
            );
          }

          // Deadline not expired - send failure notification email
          const depositAmount = parseFloat(
            participant.auction.depositAmountRequired.toString()
          );

          // Send payment failure email to user
          await this.emailService.sendPaymentFailureEmail({
            recipientEmail: participant.user.email,
            recipientName: participant.user.fullName,
            auctionCode: participant.auction.code,
            auctionName: participant.auction.name,
            paymentType: 'deposit',
            attemptedAmount: depositAmount.toLocaleString(),
            failureReason: this.getPaymentFailureReason(verification.status),
            retryUrl: `${process.env.FRONTEND_URL}/auctions/${participant.auctionId}/payment/retry?paymentId=${paymentId}`,
            deadline: deadlineDate,
          });

          // Track payment attempt
          await this.prisma.payment.update({
            where: { id: paymentId },
            data: {
              status: 'failed',
              // TODO: Add metadata field to Payment schema if needed
              // metadata: {
              //   ...((verification as any).metadata || {}),
              //   failureReason: verification.status,
              //   attemptedAt: new Date(),
              // },
            },
          });
        }

        throw new BadRequestException(
          `Payment not completed. Status: ${verification.status}. Please retry payment before the deadline.`
        );
      }

      // Step 2: Update payment record in database
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'completed',
          paidAt: new Date(),
        },
      });

      // Step 3: Update registration with deposit payment info
      const updated = await this.prisma.auctionParticipant.update({
        where: { id: registrationId },
        data: {
          depositPaidAt: new Date(),
          depositAmount: verification.amount,
          depositPaymentId: paymentId,
        },
        include: {
          auction: true,
          user: true,
        },
      });

      this.logger.log(
        `Deposit payment ${paymentId} verified and confirmed for registration ${registrationId}. Ready for Tier 2 approval.`
      );

      // Send email notification to user
      await this.emailService.sendDepositConfirmedEmail({
        recipientEmail: updated.user.email,
        recipientName: updated.user.fullName,
        auctionCode: updated.auction.code,
        auctionName: updated.auction.name,
        depositAmount: verification.amount.toLocaleString(),
        paidAt: new Date(),
        awaitingApproval: true,
      });

      // Send notification to admin(s)
      // First, get all admin users
      const adminUsers = await this.prisma.user.findMany({
        where: {
          role: { in: ['admin', 'auctioneer'] },
          isBanned: false,
          deletedAt: null,
        },
      });

      // Send notification to each admin
      const adminNotificationPromises = adminUsers.map((admin) =>
        this.emailService.sendAdminDepositNotificationEmail({
          recipientEmail: admin.email,
          adminName: admin.fullName,
          userName: updated.user.fullName,
          userEmail: updated.user.email,
          auctionCode: updated.auction.code,
          auctionName: updated.auction.name,
          depositAmount: verification.amount.toLocaleString(),
          paidAt: new Date(),
          registrationId: registrationId,
        })
      );

      // Send emails asynchronously (don't wait for completion)
      Promise.allSettled(adminNotificationPromises).catch((err) => {
        this.logger.error('Error sending admin deposit notifications:', err);
      });

      this.logger.log(
        `Email notifications sent for deposit payment ${paymentId}: user notified, ${adminUsers.length} admin(s) notified`
      );

      return {
        success: true,
        paymentVerified: true,
        depositPaid: true,
        registration: this.toDto(updated),
        message:
          'Deposit payment confirmed. Awaiting final approval from auctioneer.',
        nextStep:
          'Admin will review and give final approval. You will be notified via email.',
      };
    } catch (err) {
      // TODO: Implement comprehensive error handling
      // - Payment gateway errors
      // - Network timeouts
      // - Duplicate payment attempts
      // - Partial payment scenarios
      this.logger.error(
        `Failed to verify deposit payment ${paymentId} for registration ${registrationId}`,
        (err as Error)?.stack
      );
      throw err;
    }
  }

  /**
   * Helper method to get user-friendly payment failure reason
   */
  private getPaymentFailureReason(status: string): string {
    const reasonMap: Record<string, string> = {
      failed:
        'Payment processing failed. Please check your payment method and try again.',
      cancelled:
        'Payment was cancelled. Please retry to complete your registration.',
      expired: 'Payment session expired. Please initiate a new payment.',
      pending:
        'Payment is still pending. Please wait a few minutes and try verification again.',
      processing:
        'Payment is being processed. Please wait a few minutes before verifying.',
    };

    return (
      reasonMap[status] ||
      'Payment could not be completed. Please try again or contact support.'
    );
  }
}
