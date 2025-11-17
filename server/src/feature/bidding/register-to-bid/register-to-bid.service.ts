// Main orchestration service - delegates to specialized services by actor/context
import { Injectable, Logger } from '@nestjs/common';
import { CreateRegisterToBidDto } from './dto/create-register-to-bid.dto';
import { WithdrawRegistrationDto } from './dto/withdraw-registration.dto';
import { ApproveRegistrationDto } from './dto/approve-registration.dto';
import { RejectRegistrationDto } from './dto/reject-registration.dto';
import { ListRegistrationsQueryDto } from './dto/list-registrations-query.dto';
import { CurrentUserData } from '../../../common/decorators/current-user.decorator';
import { UserRegistrationService } from './services/user-registration.service';
import { AdminApprovalService } from './services/admin-approval.service';
import { RegistrationPaymentService } from './services/registration-payment.service';

@Injectable()
export class RegisterToBidService {
  private readonly logger = new Logger(RegisterToBidService.name);

  constructor(
    private readonly userRegistrationService: UserRegistrationService,
    private readonly adminApprovalService: AdminApprovalService,
    private readonly registrationPaymentService: RegistrationPaymentService
  ) {}

  // ========================================
  // USER OPERATIONS (UserRegistrationService)
  // ========================================

  /**
   * Create or resubmit registration for an auction
   * Delegates to UserRegistrationService
   */
  async create(dto: CreateRegisterToBidDto, currentUser: CurrentUserData) {
    return this.userRegistrationService.create(dto, currentUser);
  }

  /**
   * Withdraw user's registration from an auction
   * Delegates to UserRegistrationService
   */
  async withdraw(dto: WithdrawRegistrationDto, currentUser: CurrentUserData) {
    return this.userRegistrationService.withdraw(dto, currentUser);
  }

  /**
   * Check in for auction
   * Delegates to UserRegistrationService
   */
  async checkIn(auctionId: string, userId: string) {
    return this.userRegistrationService.checkIn(auctionId, userId);
  }

  // ========================================
  // ADMIN OPERATIONS (AdminApprovalService)
  // ========================================

  /**
   * Get all registrations for a user (admin view)
   * Delegates to AdminApprovalService
   */
  async getRegistrationStatusOfOneUserForAdmin(userId: string) {
    return this.adminApprovalService.getRegistrationStatusOfOneUserForAdmin(
      userId
    );
  }

  /**
   * Approve a registration (admin/auctioneer only)
   * Delegates to AdminApprovalService
   * @deprecated Use approveRegistrationFinal for two-tier approval
   */
  async approveRegistration(dto: ApproveRegistrationDto) {
    return this.adminApprovalService.approveRegistration(dto);
  }

  /**
   * Reject a registration (admin/auctioneer only)
   * Delegates to AdminApprovalService
   */
  async rejectRegistration(dto: RejectRegistrationDto) {
    return this.adminApprovalService.rejectRegistration(dto);
  }

  /**
   * List all registrations with pagination and filtering (admin/auctioneer only)
   * Delegates to AdminApprovalService
   */
  async listRegistrations(query: ListRegistrationsQueryDto) {
    return this.adminApprovalService.listRegistrations(query);
  }

  /**
   * TWO-TIER APPROVAL: Tier 1 - Verify Documents
   * Delegates to AdminApprovalService
   */
  async verifyDocuments(registrationId: string, adminId: string) {
    return this.adminApprovalService.verifyDocuments(registrationId, adminId);
  }

  /**
   * TWO-TIER APPROVAL: Tier 1 - Reject Documents
   * Delegates to AdminApprovalService
   */
  async rejectDocuments(registrationId: string, reason: string) {
    return this.adminApprovalService.rejectDocuments(registrationId, reason);
  }

  /**
   * TWO-TIER APPROVAL: Final Approval
   * Delegates to AdminApprovalService
   */
  async approveRegistrationFinal(registrationId: string, adminId: string) {
    return this.adminApprovalService.approveRegistrationFinal(
      registrationId,
      adminId
    );
  }

  // ========================================
  // PAYMENT OPERATIONS (RegistrationPaymentService)
  // ========================================

  /**
   * TWO-TIER APPROVAL: Tier 2 - Submit Deposit
   * Delegates to RegistrationPaymentService
   */
  async submitDeposit(
    registrationId: string,
    auctionId: string,
    amount: number,
    userId: string
  ) {
    return this.registrationPaymentService.submitDeposit(
      registrationId,
      auctionId,
      amount,
      userId
    );
  }

  /**
   * TWO-TIER APPROVAL: Verify Deposit Payment
   * Delegates to RegistrationPaymentService
   */
  async verifyDepositPayment(
    sessionId: string,
    registrationId: string,
    userId: string
  ) {
    return this.registrationPaymentService.verifyDepositPayment(
      sessionId,
      registrationId,
      userId
    );
  }

  /**
   * INTEGRATION POINT 1a: Initiate deposit payment (Tier 2 - Step 1)
   * Delegates to RegistrationPaymentService
   */
  async initiateDepositPayment(registrationId: string, userId: string) {
    return this.registrationPaymentService.initiateDepositPayment(
      registrationId,
      userId
    );
  }

  /**
   * INTEGRATION POINT 1b: Verify deposit payment and update registration
   * Delegates to RegistrationPaymentService
   */
  async verifyAndConfirmDepositPayment(
    registrationId: string,
    paymentId: string
  ) {
    return this.registrationPaymentService.verifyAndConfirmDepositPayment(
      registrationId,
      paymentId
    );
  }
}
