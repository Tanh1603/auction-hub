# Software Requirements Specification (SRS)

# Auction Hub - Vietnamese Auction Platform / Nền tảng Đấu giá Việt Nam

**Document Version:** 2.0  
**Date:** December 6, 2025  
**Project:** Auction Hub  
**Document Type:** Functional Requirements Specification

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [System Actors](#2-system-actors)
3. [Functional Requirements Overview](#3-functional-requirements-overview)
   - 3.1 [User Management Module](#31-user-management-module--quản-lý-người-dùng)
   - 3.2 [Authentication Module](#32-authentication-module--xác-thực)
   - 3.3 [Auction Management Module](#33-auction-management-module--quản-lý-phiên-đấu-giá)
   - 3.4 [Registration to Bid Module](#34-registration-to-bid-module--đăng-ký-tham-gia-đấu-giá)
   - 3.5 [Bidding System Module](#35-bidding-system-module--hệ-thống-đặt-giá)
   - 3.6 [Auction Finalization Module](#36-auction-finalization-module--hoàn-tất-phiên-đấu-giá)
   - 3.7 [Payment Module](#37-payment-module--thanh-toán)
   - 3.8 [Auction Cost Management Module](#38-auction-cost-management-module--quản-lý-chi-phí-đấu-giá)
   - 3.9 [System Configuration Module](#39-system-configuration-module--cấu-hình-hệ-thống)
   - 3.10 [Location Module](#310-location-module--địa-điểm)
   - 3.11 [Article Module](#311-article-module--bài-viết)
4. [Data Models Summary](#4-data-models-summary)
5. [Appendix: API Endpoints Summary](#5-appendix-api-endpoints-summary)

---

## 1. Introduction

### 1.1 Purpose

This document provides a comprehensive Software Requirements Specification (SRS) for the Auction Hub platform, a localized Vietnamese auction website. It describes the functional requirements derived from reverse-engineering the existing codebase.

### 1.2 Scope

The Auction Hub platform enables online auctions for various asset types including:

- **Tài sản bảo đảm** (Secured Assets)
- **Quyền sử dụng đất** (Land Use Rights)
- **Tài sản vi phạm hành chính** (Administrative Violation Assets)
- **Tài sản nhà nước** (State Assets)
- **Tài sản thi hành án** (Enforcement Assets)
- **Tài sản khác** (Other Assets)

### 1.3 Technology Stack

- **Backend:** NestJS (Node.js framework)
- **Database:** PostgreSQL with Prisma ORM
- **Authentication:** Supabase Auth
- **Payment:** Stripe Integration
- **Real-time:** WebSocket (Socket.io)
- **File Storage:** Cloudinary
- **Email:** SMTP (Nodemailer)

---

## 2. System Actors

| Actor ID | Actor Name (EN) | Actor Name (VI)       | Description                                                                             |
| -------- | --------------- | --------------------- | --------------------------------------------------------------------------------------- |
| A01      | **Bidder**      | Người đấu giá         | End-user who participates in auctions to bid on assets                                  |
| A02      | **Auctioneer**  | Người bán đấu giá     | User who creates and manages auction listings                                           |
| A03      | **Admin**       | Quản trị viên         | System administrator who manages users, approves registrations, and oversees operations |
| A04      | **Super Admin** | Quản trị viên cấp cao | Highest privilege level with full system access                                         |
| A05      | **System**      | Hệ thống              | Automated processes (timers, scheduled tasks, WebSocket events)                         |
| A06      | **Guest**       | Khách                 | Unauthenticated user viewing public auction information                                 |

### 2.1 Role Hierarchy

```
Super Admin (super_admin)
    └── Admin (admin)
        └── Auctioneer (auctioneer)
            └── Bidder (bidder)
```

---

## 3. Functional Requirements Overview

---

### 3.1 User Management Module / Quản lý Người dùng

**Actor:** Admin, Super Admin, Bidder (self-service)

**Description:** Manages user accounts, profiles, verification status, and role assignments. Supports both individual (`individual`) and business (`business`) user types.

#### Sub-Feature List:

| ID    | Function Name (EN)         | Function Name (VI)                | Trigger/API Endpoint                    | Actor              |
| ----- | -------------------------- | --------------------------------- | --------------------------------------- | ------------------ |
| 3.1.1 | Register User in System    | Đăng ký người dùng vào hệ thống   | `POST /auth/register`                   | Guest              |
| 3.1.2 | Get Current User Info      | Lấy thông tin người dùng hiện tại | `GET /auth/me`                          | All Authenticated  |
| 3.1.3 | Promote User Role          | Nâng cấp vai trò người dùng       | `PUT /auth/admin/users/:userId/promote` | Admin, Super Admin |
| 3.1.4 | Ban User                   | Cấm người dùng                    | Internal (via `isBanned` field)         | Admin, Super Admin |
| 3.1.5 | Verify User Identity (KYC) | Xác minh danh tính                | Internal (via `isVerified` field)       | Admin, Super Admin |

#### Business Rules:

- All new users start with `bidder` role by default
- Only `admin` and `super_admin` can promote users
- Regular `admin` cannot promote users to `admin` or `super_admin` roles
- `super_admin` can promote to any role
- Users can be of type `individual` or `business`
- Business users must provide `taxId`
- Users have rating score (`ratingScore`) and total ratings count (`totalRatings`)

---

### 3.2 Authentication Module / Xác thực

**Actor:** Guest, All Users

**Description:** Handles user authentication including registration, login, email verification, and password recovery using Supabase Auth integration.

#### Sub-Feature List:

| ID    | Function Name (EN)        | Function Name (VI)      | Trigger/API Endpoint                   | Actor |
| ----- | ------------------------- | ----------------------- | -------------------------------------- | ----- |
| 3.2.1 | Register Account          | Đăng ký tài khoản       | `POST /auth/register`                  | Guest |
| 3.2.2 | Login                     | Đăng nhập               | `POST /auth/login`                     | Guest |
| 3.2.3 | Forgot Password           | Quên mật khẩu           | `POST /auth/forgot-password`           | Guest |
| 3.2.4 | Resend Verification Email | Gửi lại email xác thực  | `POST /auth/resend-verification-email` | Guest |
| 3.2.5 | Verify Email (POST)       | Xác thực email          | `POST /auth/verify-email`              | Guest |
| 3.2.6 | Verify Email (Link Click) | Xác thực email qua link | `GET /auth/verify?token=xxx&email=xxx` | Guest |

#### Business Rules:

- Registration creates user in both Supabase and local database atomically
- Email must be verified before full account access
- JWT tokens are validated through Supabase
- Password reset codes are sent via email

---

### 3.3 Auction Management Module / Quản lý Phiên đấu giá

**Actor:** Auctioneer, Admin, Super Admin

**Description:** Manages the complete lifecycle of auction listings including creation, updates, resource management (images/attachments), deletion, and relation management.

#### Sub-Feature List:

| ID    | Function Name (EN)       | Function Name (VI)             | Trigger/API Endpoint            | Actor             |
| ----- | ------------------------ | ------------------------------ | ------------------------------- | ----------------- |
| 3.3.1 | List All Auctions        | Danh sách phiên đấu giá        | `GET /auctions`                 | All (Public)      |
| 3.3.2 | Get Auction Details      | Chi tiết phiên đấu giá         | `GET /auctions/:id`             | All (Public)      |
| 3.3.3 | Create Auction           | Tạo phiên đấu giá              | `POST /auctions`                | Auctioneer, Admin |
| 3.3.4 | Update Auction           | Cập nhật phiên đấu giá         | `PUT /auctions/:id`             | Auctioneer, Admin |
| 3.3.5 | Delete Auction           | Xóa phiên đấu giá              | `DELETE /auctions/:id`          | Auctioneer, Admin |
| 3.3.6 | Update Auction Relations | Cập nhật quan hệ phiên đấu giá | `PATCH /auctions/:id/relations` | Auctioneer, Admin |

#### Auction Status Lifecycle:

```
scheduled → live → awaiting_result → success/failed
```

| Status            | Description (EN)                          | Description (VI) |
| ----------------- | ----------------------------------------- | ---------------- |
| `scheduled`       | Auction is scheduled but not yet started  | Đã lên lịch      |
| `live`            | Auction is currently active               | Đang diễn ra     |
| `awaiting_result` | Auction ended, pending evaluation         | Đang chờ kết quả |
| `success`         | Auction completed with winning bid        | Thành công       |
| `failed`          | Auction ended without winner or cancelled | Thất bại         |

**Note:** The `no_bid` and `cancelled` statuses from v1.0 have been replaced with `failed`.

#### Auction Data Fields:

- **Basic Info:** name, code (unique), assetType, assetDescription, assetAddress
- **Timeline:** saleStartAt, saleEndAt, depositEndAt, auctionStartAt, auctionEndAt
- **Pricing:** startingPrice, bidIncrement, reservePrice (optional), depositAmountRequired
- **Fees:** saleFee, dossierFee, depositPercentage
- **Check-in Window:** validCheckInBeforeStartMinutes, validCheckInAfterStartMinutes
- **Media:** images (JsonB), attachments (JsonB)
- **Location:** assetWardId (required), assetProvinceId (required)
- **Property Owner:** propertyOwner (JsonB - denormalized snapshot of owner data)

#### PropertyOwner JSON Structure:

```json
{
  "id": "uuid",
  "fullName": "string",
  "email": "string",
  "phoneNumber": "string (optional)",
  "identityNumber": "string (optional)",
  "userType": "string (optional)",
  "avatarUrl": "string (optional)"
}
```

---

### 3.4 Registration to Bid Module / Đăng ký Tham gia Đấu giá

**Actor:** Bidder, Admin, Auctioneer

**Description:** Manages the multi-tier approval process for bidders to participate in auctions, including document submission, verification, deposit payment, and final approval.

#### Two-Tier Approval Process:

1. **Tier 1 - Document Verification:** Admin verifies submitted documents
2. **Tier 2 - Deposit Verification:** System verifies deposit payment

#### Sub-Feature List (Bidder Actions):

| ID    | Function Name (EN)           | Function Name (VI)       | Trigger/API Endpoint                                    | Actor  |
| ----- | ---------------------------- | ------------------------ | ------------------------------------------------------- | ------ |
| 3.4.1 | Register for Auction         | Đăng ký tham gia đấu giá | `POST /register-to-bid`                                 | Bidder |
| 3.4.2 | Withdraw Registration        | Rút đăng ký              | `POST /register-to-bid/withdraw`                        | Bidder |
| 3.4.3 | Check-in for Auction         | Điểm danh tham gia       | `POST /register-to-bid/check-in`                        | Bidder |
| 3.4.4 | Submit Deposit Payment       | Nộp tiền đặt cọc         | `POST /register-to-bid/submit-deposit`                  | Bidder |
| 3.4.5 | Verify Deposit Payment       | Xác nhận thanh toán cọc  | `POST /register-to-bid/verify-deposit-payment`          | Bidder |
| 3.4.6 | View Own Registrations       | Xem đăng ký của mình     | `GET /register-to-bid/users/:userId/registrations`      | Bidder |
| 3.4.7 | Get Registration for Auction | Xem đăng ký cho phiên    | `GET /register-to-bid/auctions/:auctionId/registration` | Bidder |

#### Sub-Feature List (Admin Actions):

| ID     | Function Name (EN)        | Function Name (VI) | Trigger/API Endpoint                           | Actor             |
| ------ | ------------------------- | ------------------ | ---------------------------------------------- | ----------------- |
| 3.4.8  | List All Registrations    | Danh sách đăng ký  | `GET /register-to-bid/admin/registrations`     | Admin, Auctioneer |
| 3.4.9  | Approve Registration      | Duyệt đăng ký      | `POST /register-to-bid/admin/approve`          | Admin, Auctioneer |
| 3.4.10 | Reject Registration       | Từ chối đăng ký    | `POST /register-to-bid/admin/reject`           | Admin, Auctioneer |
| 3.4.11 | Verify Documents (Tier 1) | Xác minh tài liệu  | `POST /register-to-bid/admin/verify-documents` | Admin, Auctioneer |
| 3.4.12 | Reject Documents          | Từ chối tài liệu   | `POST /register-to-bid/admin/reject-documents` | Admin, Auctioneer |
| 3.4.13 | Final Approval (Tier 2)   | Duyệt cuối cùng    | `POST /register-to-bid/admin/final-approval`   | Admin, Auctioneer |

#### Registration State Flow:

```
                     ┌─────────────────────┐
                     │   User Registers    │
                     │   (submittedAt)     │
                     └─────────┬───────────┘
                               │
                     ┌─────────▼───────────┐
           ┌─────────┤  Document Review    │──────────┐
           │         │  (Tier 1)           │          │
           │         └─────────────────────┘          │
           │                                          │
  ┌────────▼────────┐                       ┌─────────▼─────────┐
  │ Docs Verified   │                       │  Docs Rejected    │
  │(documentsVerifiedAt)                    │(documentsRejectedAt)
  └────────┬────────┘                       │  → Can Resubmit   │
           │                                └───────────────────┘
  ┌────────▼────────┐
  │ Deposit Payment │
  │ (Tier 2)        │
  │(depositPaidAt)  │
  └────────┬────────┘
           │
  ┌────────▼────────┐
  │ Final Approval  │
  │ (confirmedAt)   │
  └────────┬────────┘
           │
  ┌────────▼────────┐
  │   Check-in      │
  │ (checkedInAt)   │
  └────────┬────────┘
           │
  ┌────────▼────────┐
  │ Ready to Bid    │
  └─────────────────┘
```

#### Business Rules:

- Registration period closes at `depositEndAt`
- Check-in window: `validCheckInBeforeStartMinutes` before to `validCheckInAfterStartMinutes` after auction start
- Bidders can withdraw before auction starts and before check-in
- Rejected bidders can resubmit after fixing issues
- Withdrawn bidders can re-apply
- Documents and media are uploaded via multipart form-data to Cloudinary

---

### 3.5 Bidding System Module / Hệ thống Đặt giá

**Actor:** Bidder, Auctioneer, Admin, System

**Description:** Manages real-time bidding during live auctions including manual bids, auto-bids, bid validation, and WebSocket-based live updates. Uses a **hybrid architecture**: REST API for placing bids, WebSocket for receiving updates.

#### Sub-Feature List:

| ID    | Function Name (EN)              | Function Name (VI)          | Trigger/API Endpoint       | Actor             |
| ----- | ------------------------------- | --------------------------- | -------------------------- | ----------------- |
| 3.5.1 | Place Manual Bid                | Đặt giá thủ công            | `POST /manual-bid`         | Bidder            |
| 3.5.2 | Deny Bid                        | Từ chối lệnh đặt giá        | `POST /manual-bid/deny`    | Admin, Auctioneer |
| 3.5.3 | Join Auction Room               | Tham gia phòng đấu giá      | WebSocket: `joinAuction`   | Bidder            |
| 3.5.4 | Leave Auction Room              | Rời phòng đấu giá           | WebSocket: `leaveAuction`  | Bidder            |
| 3.5.5 | Receive Auction State           | Nhận trạng thái đấu giá     | WebSocket: `auctionState`  | Bidder            |
| 3.5.6 | Receive New Bid Notification    | Nhận thông báo đặt giá mới  | WebSocket: `newBid`        | Bidder            |
| 3.5.7 | Receive Time Updates            | Nhận cập nhật thời gian     | WebSocket: `timeUpdate`    | Bidder            |
| 3.5.8 | Receive Bid Denied Notification | Nhận thông báo từ chối giá  | WebSocket: `bidDenied`     | Bidder            |
| 3.5.9 | Receive Auction Update          | Nhận cập nhật phiên đấu giá | WebSocket: `auctionUpdate` | Bidder            |

#### Bid Types:

- `manual`: Manually placed by bidder
- `auto`: Automatically placed by auto-bid system

#### WebSocket Events:

| Event           | Direction       | Description                              | Payload Wrapper     |
| --------------- | --------------- | ---------------------------------------- | ------------------- |
| `joinAuction`   | Client → Server | Join auction room for real-time updates  | No                  |
| `leaveAuction`  | Client → Server | Leave auction room                       | No                  |
| `auctionState`  | Server → Client | Current auction state with winning bid   | No (direct)         |
| `newBid`        | Server → Client | New bid placed notification (full state) | No (direct)         |
| `timeUpdate`    | Server → Client | Time remaining update (every second)     | Yes `{event, data}` |
| `bidDenied`     | Server → Client | Bid denied notification                  | No (direct)         |
| `auctionUpdate` | Server → Client | General auction status update            | No (direct)         |
| `error`         | Server → Client | Error notification                       | Acknowledgment      |

#### Auction State Payload:

```typescript
{
  auctionId: string;
  name: string;
  code: string;
  status: 'scheduled' | 'live' | 'awaiting_result' | 'success' | 'failed';
  hasStarted: boolean;
  hasEnded: boolean;
  isActive: boolean;
  timeRemaining: number; // milliseconds
  auctionStartAt: string;
  auctionEndAt: string;
  startingPrice: number;
  bidIncrement: number;
  reservePrice: number | null;
  currentWinningBid: {
    bidId: string;
    amount: number;
    bidAt: string;
    participantId: string;
    bidderName: string;
    isWinningBid: boolean;
  } | null;
  nextMinimumBid: number;
  totalBids: number;
  totalParticipants: number;
  bidHistory: Array<{ bidId, amount, bidAt, bidderName }>;
}
```

#### Business Rules:

- **Eligibility:** Bidder must be confirmed, checked-in, not withdrawn
- **First Bid:** Must be ≥ starting price
- **Subsequent Bids:** Must be > current highest bid
- **Bid Increment:** All bids must follow the defined increment
- **Auction Status:** Bids only accepted when auction status is `live`
- **Time Window:** Bids only accepted between `auctionStartAt` and `auctionEndAt`
- **Concurrency:** Transactions used to prevent race conditions

#### Bid Denial Rules:

- Only auction owner (auctioneer), admin, or super_admin can deny bids
- Cannot deny already withdrawn bids
- Denied bids are excluded from winning bid calculation

---

### 3.6 Auction Finalization Module / Hoàn tất Phiên đấu giá

**Actor:** Admin, Auctioneer, Bidder (Winner), System

**Description:** Handles post-auction processes including evaluation, finalization, status override, winner payment processing, and contract generation.

#### Sub-Feature List:

| ID    | Function Name (EN)              | Function Name (VI)                 | Trigger/API Endpoint                                               | Actor              |
| ----- | ------------------------------- | ---------------------------------- | ------------------------------------------------------------------ | ------------------ |
| 3.6.1 | Evaluate Auction                | Đánh giá phiên đấu giá             | `GET /auction-finalization/evaluate/:auctionId`                    | Admin, Auctioneer  |
| 3.6.2 | Finalize Auction                | Hoàn tất phiên đấu giá             | `POST /auction-finalization/finalize`                              | Admin, Auctioneer  |
| 3.6.3 | Override Auction Status         | Ghi đè trạng thái                  | `POST /auction-finalization/override`                              | Admin, Super Admin |
| 3.6.4 | Get Auction Results             | Xem kết quả đấu giá                | `GET /auction-finalization/results/:auctionId`                     | All Participants   |
| 3.6.5 | Get Audit Logs                  | Xem nhật ký kiểm toán              | `GET /auction-finalization/audit-logs/:auctionId`                  | Admin, Auctioneer  |
| 3.6.6 | Get Winner Payment Requirements | Xem yêu cầu thanh toán người thắng | `GET /auction-finalization/winner-payment-requirements/:auctionId` | Winner             |
| 3.6.7 | Initiate Winner Payment         | Khởi tạo thanh toán người thắng    | `POST /auction-finalization/submit-winner-payment`                 | Winner             |
| 3.6.8 | Verify Winner Payment           | Xác nhận thanh toán người thắng    | `POST /auction-finalization/verify-winner-payment`                 | Winner, Admin      |

#### Audit Actions:

| Action                 | Description                    |
| ---------------------- | ------------------------------ |
| `STATUS_OVERRIDE`      | Manual status change by admin  |
| `BID_DENIED`           | Bid was denied by auctioneer   |
| `PARTICIPANT_APPROVED` | Registration approved          |
| `PARTICIPANT_REJECTED` | Registration rejected          |
| `AUCTION_FINALIZED`    | Auction finalization completed |
| `CONTRACT_CREATED`     | Contract generated for winner  |
| `AUCTION_CREATED`      | New auction created            |
| `AUCTION_UPDATED`      | Auction details updated        |
| `AUCTION_CANCELLED`    | Auction was cancelled          |

#### Financial Summary Fields (Frozen after finalization):

- `finalSalePrice`: Final winning bid amount
- `commissionFee`: Platform commission
- `startingPriceSnapshot`: Starting price at finalization
- `dossierFeeSnapshot`: Dossier fee at finalization
- `depositAmountSnapshot`: Deposit amount at finalization
- `totalAuctionCosts`: Sum of all auction costs
- `totalFeesToPropertyOwner`: Fees owed to property owner
- `netAmountToPropertyOwner`: Net amount after fees
- `financialCalculatedAt`: Timestamp of calculation
- `calculationDetails`: JSON with detailed breakdown

---

### 3.7 Payment Module / Thanh toán

**Actor:** Bidder, Winner, System

**Description:** Manages all payment operations using Stripe integration including deposit payments, winning payments, refunds, and payment verification.

#### Sub-Feature List:

| ID    | Function Name (EN)     | Function Name (VI)   | Trigger/API Endpoint                  | Actor          |
| ----- | ---------------------- | -------------------- | ------------------------------------- | -------------- |
| 3.7.1 | Create Payment Session | Tạo phiên thanh toán | `POST /payments`                      | Bidder, Winner |
| 3.7.2 | Verify Payment         | Xác nhận thanh toán  | `GET /payments/verify?session_id=xxx` | Bidder, Winner |

#### Payment Types:

| Type                | Description (EN)              | Description (VI)       |
| ------------------- | ----------------------------- | ---------------------- |
| `deposit`           | Auction participation deposit | Tiền cọc tham gia      |
| `participation_fee` | Auction participation fee     | Phí tham gia           |
| `winning_payment`   | Winner's final payment        | Thanh toán người thắng |
| `refund`            | Refund of deposit             | Hoàn trả cọc           |

#### Payment Status:

| Status       | Description                            |
| ------------ | -------------------------------------- |
| `pending`    | Payment initiated, awaiting completion |
| `processing` | Payment is being processed             |
| `completed`  | Payment successfully completed         |
| `failed`     | Payment failed                         |
| `refunded`   | Payment was refunded                   |

#### Payment Methods:

- `bank_transfer`: Bank transfer / Chuyển khoản
- `e_wallet`: E-wallet payment / Ví điện tử
- `cash`: Cash payment / Tiền mặt

#### Payment Flow:

```
┌─────────────────┐
│ Create Payment  │
│ (Stripe Session)│
└────────┬────────┘
         │
┌────────▼────────┐
│ User Redirected │
│ to Stripe       │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌───▼───┐
│Success│ │Cancel │
└───┬───┘ └───────┘
    │
┌───▼────────────┐
│ Verify Payment │
│ (session_id)   │
└───┬────────────┘
    │
┌───▼────────────┐
│ Update DB      │
│ Status         │
└────────────────┘
```

---

### 3.8 Auction Cost Management Module / Quản lý Chi phí Đấu giá

**Actor:** Admin, Auctioneer

**Description:** Manages variable costs associated with each auction including advertising, venue rental, appraisal, and other miscellaneous costs.

#### Sub-Feature List:

| ID    | Function Name (EN)          | Function Name (VI)      | Trigger/API Endpoint                                | Actor             |
| ----- | --------------------------- | ----------------------- | --------------------------------------------------- | ----------------- |
| 3.8.1 | Create/Update Auction Costs | Tạo/Cập nhật chi phí    | `POST /auction-costs/auction/:auctionId`            | Admin, Auctioneer |
| 3.8.2 | Get Auction Costs           | Xem chi phí đấu giá     | `GET /auction-costs/auction/:auctionId`             | All Authenticated |
| 3.8.3 | Update Specific Cost Fields | Cập nhật chi phí cụ thể | `PATCH /auction-costs/auction/:auctionId`           | Admin, Auctioneer |
| 3.8.4 | Delete Auction Costs        | Xóa chi phí đấu giá     | `DELETE /auction-costs/auction/:auctionId`          | Admin             |
| 3.8.5 | Add Other Cost Item         | Thêm chi phí khác       | `POST /auction-costs/auction/:auctionId/other-cost` | Admin, Auctioneer |

#### Cost Categories:

| Category           | Description (EN)                 | Description (VI)      |
| ------------------ | -------------------------------- | --------------------- |
| `advertisingCost`  | Marketing and advertising        | Chi phí quảng cáo     |
| `venueRentalCost`  | Auction venue rental             | Chi phí thuê địa điểm |
| `appraisalCost`    | Asset appraisal                  | Chi phí thẩm định     |
| `assetViewingCost` | Asset viewing organization       | Chi phí xem tài sản   |
| `otherCosts`       | Miscellaneous costs (JSON array) | Chi phí khác          |

---

### 3.9 System Configuration Module / Cấu hình Hệ thống

**Actor:** Admin, Super Admin

**Description:** Manages system-wide configuration variables stored in the database, including fee percentages, deposit rules, and other policy settings.

#### Sub-Feature List:

| ID    | Function Name (EN)       | Function Name (VI)       | Trigger/API Endpoint                     | Actor              |
| ----- | ------------------------ | ------------------------ | ---------------------------------------- | ------------------ |
| 3.9.1 | Get All System Variables | Xem tất cả biến hệ thống | `GET /system-variables`                  | Admin, Super Admin |
| 3.9.2 | Get System Variable      | Xem biến hệ thống        | `GET /system-variables/:category/:key`   | Admin, Super Admin |
| 3.9.3 | Update System Variable   | Cập nhật biến hệ thống   | `PATCH /system-variables/:category/:key` | Admin, Super Admin |
| 3.9.4 | Create System Variable   | Tạo biến hệ thống        | `POST /system-variables`                 | Admin, Super Admin |
| 3.9.5 | Clear Cache              | Xóa bộ nhớ đệm           | `POST /system-variables/cache/clear`     | Admin, Super Admin |
| 3.9.6 | Get Cache Statistics     | Xem thống kê bộ nhớ đệm  | `GET /system-variables/cache/stats`      | Admin, Super Admin |

#### Variable Categories:

- `deposit` - Deposit percentage rules
- `commission` - Commission fee settings
- `dossier` - Dossier fee configuration
- `general` - General system settings

#### Data Types:

- `number` - Numeric values
- `boolean` - True/false values
- `string` - Text values
- `json` - Complex JSON objects

---

### 3.10 Location Module / Địa điểm

**Actor:** All (Public)

**Description:** Provides location data for province/ward selection in auction asset addresses.

#### Sub-Feature List:

| ID     | Function Name (EN) | Function Name (VI)  | Trigger/API Endpoint | Actor        |
| ------ | ------------------ | ------------------- | -------------------- | ------------ |
| 3.10.1 | Get All Locations  | Xem tất cả địa điểm | `GET /locations`     | All (Public) |

#### Location Hierarchy:

Locations are stored in a hierarchical structure:

- Province (cấp tỉnh) → District (cấp huyện) → Ward (cấp xã)

---

### 3.11 Article Module / Bài viết

**Actor:** Admin, All (Public for viewing)

**Description:** Manages articles including news, auction notices, reports, and legal documents.

#### Sub-Feature List:

| ID     | Function Name (EN)       | Function Name (VI)        | Trigger/API Endpoint            | Actor        |
| ------ | ------------------------ | ------------------------- | ------------------------------- | ------------ |
| 3.11.1 | List All Articles        | Danh sách bài viết        | `GET /articles`                 | All (Public) |
| 3.11.2 | Get Article Details      | Chi tiết bài viết         | `GET /articles/:id`             | All (Public) |
| 3.11.3 | Create Article           | Tạo bài viết              | `POST /articles`                | Admin        |
| 3.11.4 | Update Article           | Cập nhật bài viết         | `PUT /articles/:id`             | Admin        |
| 3.11.5 | Update Article Relations | Cập nhật quan hệ bài viết | `PATCH /articles/:id/relations` | Admin        |
| 3.11.6 | Delete Article           | Xóa bài viết              | `DELETE /articles/:id`          | Admin        |

#### Article Types:

| Type             | Description (EN)      | Description (VI)        |
| ---------------- | --------------------- | ----------------------- |
| `news`           | General news          | Tin tức                 |
| `auction_notice` | Auction announcement  | Thông báo đấu giá       |
| `auction_report` | Auction result report | Báo cáo kết quả đấu giá |
| `legal_document` | Legal documentation   | Văn bản pháp luật       |

---

## 4. Data Models Summary

### 4.1 Core Entities

| Entity               | Description               | Key Fields                                                                                              |
| -------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------- |
| `User`               | Platform users            | id, email, phoneNumber, fullName, identityNumber, userType, role, ratingScore                           |
| `Auction`            | Auction listings          | id, code, name, status, startingPrice, bidIncrement, propertyOwner (JSON), assetWardId, assetProvinceId |
| `AuctionParticipant` | User-Auction registration | id, userId, auctionId, confirmedAt, checkedInAt, depositPaidAt, documents (JSON)                        |
| `AuctionBid`         | Individual bids           | id, auctionId, participantId, amount, bidAt, bidType, isWinningBid, isDenied                            |
| `Payment`            | Payment transactions      | id, userId, auctionId, registrationId, paymentType, amount, status, currency                            |
| `Contract`           | Winner contracts          | id, auctionId, winningBidId, buyerUserId, propertyOwnerUserId, price, status                            |
| `AuctionCost`        | Auction variable costs    | id, auctionId, advertisingCost, venueRentalCost, totalCosts, otherCosts (JSON)                          |
| `AuctionAuditLog`    | Audit trail               | id, auctionId, performedBy, action, previousStatus, newStatus, reason, metadata                         |
| `SystemVariable`     | System configuration      | id, category, key, value, dataType, isActive, updatedBy                                                 |
| `AutoBidSetting`     | Auto-bid configuration    | id, participantId, maxAmount, incrementAmount, isActive                                                 |
| `Location`           | Geographic locations      | id, name, value, sortOrder, parentId                                                                    |
| `Article`            | Content articles          | id, type, title, description, image, author, content                                                    |
| `AuctionRelation`    | Related auctions link     | auctionId, relatedAuctionId                                                                             |
| `ArticleRelation`    | Related articles link     | articleId, relatedArticleId                                                                             |

### 4.2 Enumerations

| Enum             | Values                                                                                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UserType`       | individual, business                                                                                                                                              |
| `UserRole`       | bidder, auctioneer, admin, super_admin                                                                                                                            |
| `AuctionStatus`  | scheduled, live, awaiting_result, success, failed                                                                                                                 |
| `AssetType`      | secured_asset, land_use_rights, administrative_violation_asset, state_asset, enforcement_asset, other_asset                                                       |
| `PaymentType`    | deposit, participation_fee, winning_payment, refund                                                                                                               |
| `PaymentStatus`  | pending, processing, completed, failed, refunded                                                                                                                  |
| `PaymentMethod`  | bank_transfer, e_wallet, cash                                                                                                                                     |
| `BidType`        | manual, auto                                                                                                                                                      |
| `ContractStatus` | draft, signed, cancelled, completed                                                                                                                               |
| `AuditAction`    | STATUS_OVERRIDE, BID_DENIED, PARTICIPANT_APPROVED, PARTICIPANT_REJECTED, AUCTION_FINALIZED, CONTRACT_CREATED, AUCTION_CREATED, AUCTION_UPDATED, AUCTION_CANCELLED |
| `ArticleType`    | news, auction_notice, auction_report, legal_document                                                                                                              |

---

## 5. Appendix: API Endpoints Summary

### Authentication Endpoints

| Method | Endpoint                            | Description               | Auth Required |
| ------ | ----------------------------------- | ------------------------- | ------------- |
| POST   | `/auth/register`                    | Register new user         | No            |
| POST   | `/auth/login`                       | User login                | No            |
| POST   | `/auth/forgot-password`             | Request password reset    | No            |
| POST   | `/auth/resend-verification-email`   | Resend verification email | No            |
| POST   | `/auth/verify-email`                | Verify email with token   | No            |
| GET    | `/auth/verify`                      | Verify email from link    | No            |
| GET    | `/auth/me`                          | Get current user          | Yes           |
| PUT    | `/auth/admin/users/:userId/promote` | Promote user role         | Admin         |

### Auction Endpoints

| Method | Endpoint                  | Description              | Auth Required |
| ------ | ------------------------- | ------------------------ | ------------- |
| GET    | `/auctions`               | List all auctions        | No            |
| GET    | `/auctions/:id`           | Get auction details      | No            |
| POST   | `/auctions`               | Create auction           | Auctioneer    |
| PUT    | `/auctions/:id`           | Update auction           | Auctioneer    |
| DELETE | `/auctions/:id`           | Delete auction           | Auctioneer    |
| PATCH  | `/auctions/:id/relations` | Update auction relations | Auctioneer    |

### Registration Endpoints

| Method | Endpoint                                            | Description                  | Auth Required |
| ------ | --------------------------------------------------- | ---------------------------- | ------------- |
| POST   | `/register-to-bid`                                  | Register for auction         | Bidder        |
| POST   | `/register-to-bid/withdraw`                         | Withdraw registration        | Bidder        |
| POST   | `/register-to-bid/check-in`                         | Check-in for auction         | Bidder        |
| POST   | `/register-to-bid/submit-deposit`                   | Submit deposit               | Bidder        |
| POST   | `/register-to-bid/verify-deposit-payment`           | Verify deposit               | Bidder        |
| GET    | `/register-to-bid/users/:userId/registrations`      | Get user's registrations     | Bidder        |
| GET    | `/register-to-bid/auctions/:auctionId/registration` | Get registration for auction | Bidder        |
| GET    | `/register-to-bid/admin/registrations`              | List all registrations       | Admin         |
| POST   | `/register-to-bid/admin/approve`                    | Approve registration         | Admin         |
| POST   | `/register-to-bid/admin/reject`                     | Reject registration          | Admin         |
| POST   | `/register-to-bid/admin/verify-documents`           | Verify documents             | Admin         |
| POST   | `/register-to-bid/admin/reject-documents`           | Reject documents             | Admin         |
| POST   | `/register-to-bid/admin/final-approval`             | Final approval               | Admin         |

### Bidding Endpoints

| Method | Endpoint           | Description      | Auth Required     |
| ------ | ------------------ | ---------------- | ----------------- |
| POST   | `/manual-bid`      | Place manual bid | Bidder            |
| POST   | `/manual-bid/deny` | Deny a bid       | Admin, Auctioneer |

### Finalization Endpoints

| Method | Endpoint                                                       | Description              | Auth Required |
| ------ | -------------------------------------------------------------- | ------------------------ | ------------- |
| GET    | `/auction-finalization/evaluate/:auctionId`                    | Evaluate auction         | Admin         |
| POST   | `/auction-finalization/finalize`                               | Finalize auction         | Admin         |
| POST   | `/auction-finalization/override`                               | Override status          | Admin         |
| GET    | `/auction-finalization/results/:auctionId`                     | Get results              | Authenticated |
| GET    | `/auction-finalization/audit-logs/:auctionId`                  | Get audit logs           | Admin         |
| GET    | `/auction-finalization/winner-payment-requirements/:auctionId` | Get payment requirements | Winner        |
| POST   | `/auction-finalization/submit-winner-payment`                  | Submit winner payment    | Winner        |
| POST   | `/auction-finalization/verify-winner-payment`                  | Verify winner payment    | Winner        |

### Payment Endpoints

| Method | Endpoint           | Description    | Auth Required |
| ------ | ------------------ | -------------- | ------------- |
| POST   | `/payments`        | Create payment | Yes           |
| GET    | `/payments/verify` | Verify payment | Yes           |

### Auction Cost Endpoints

| Method | Endpoint                                       | Description            | Auth Required |
| ------ | ---------------------------------------------- | ---------------------- | ------------- |
| POST   | `/auction-costs/auction/:auctionId`            | Create/Update costs    | Admin         |
| GET    | `/auction-costs/auction/:auctionId`            | Get costs              | Yes           |
| PATCH  | `/auction-costs/auction/:auctionId`            | Update specific fields | Admin         |
| DELETE | `/auction-costs/auction/:auctionId`            | Delete costs           | Admin         |
| POST   | `/auction-costs/auction/:auctionId/other-cost` | Add other cost         | Admin         |

### System Variables Endpoints

| Method | Endpoint                           | Description           | Auth Required |
| ------ | ---------------------------------- | --------------------- | ------------- |
| GET    | `/system-variables`                | Get all variables     | Admin         |
| GET    | `/system-variables/:category/:key` | Get specific variable | Admin         |
| PATCH  | `/system-variables/:category/:key` | Update variable       | Admin         |
| POST   | `/system-variables`                | Create variable       | Admin         |
| POST   | `/system-variables/cache/clear`    | Clear cache           | Admin         |
| GET    | `/system-variables/cache/stats`    | Get cache statistics  | Admin         |

### Location Endpoints

| Method | Endpoint     | Description       | Auth Required |
| ------ | ------------ | ----------------- | ------------- |
| GET    | `/locations` | Get all locations | No            |

### Article Endpoints

| Method | Endpoint                  | Description              | Auth Required |
| ------ | ------------------------- | ------------------------ | ------------- |
| GET    | `/articles`               | List all articles        | No            |
| GET    | `/articles/:id`           | Get article details      | No            |
| POST   | `/articles`               | Create article           | Admin         |
| PUT    | `/articles/:id`           | Update article           | Admin         |
| PATCH  | `/articles/:id/relations` | Update article relations | Admin         |
| DELETE | `/articles/:id`           | Delete article           | Admin         |

---

## Document History

| Version | Date       | Author                           | Changes                                                                                                                                                                                                           |
| ------- | ---------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2025-12-03 | Reverse-Engineered from Codebase | Initial document creation                                                                                                                                                                                         |
| 2.0     | 2025-12-06 | Reverse-Engineered from Codebase | Updated AuctionStatus enum (removed no_bid/cancelled, added awaiting_result/failed), updated propertyOwner to JSON, added Location/Article modules, added System Variables module, updated registration endpoints |

---

_This document was generated by analyzing the Auction Hub codebase structure, controllers, services, gateways, and Prisma schema._
