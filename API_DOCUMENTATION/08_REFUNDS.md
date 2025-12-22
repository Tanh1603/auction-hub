# 💸 Refund & Disqualification API

This document covers the deposit refund and participant disqualification endpoints.

## Overview

The refund system follows Vietnamese auction regulations (Nghị định 17/2010/NĐ-CP) for deposit handling.

> [!IMPORTANT] > **Deposit vs Application Fee**
>
> - **Deposit (Tiền đặt trước)**: Refundable to eligible non-winners
> - **Application Fee (Phí hồ sơ)**: **NON-REFUNDABLE** under any circumstances
>
> **Refund = Deposit ONLY** (Application fee is never refunded)

### Automatic Refund (3 Business Days)

Non-winning participants who did not violate rules receive an **AUTOMATIC** refund within **3 business days** after auction finalization. The system runs a daily scheduled job to process these refunds.

### Base URL

```
/api/register-to-bid
```

---

## Refund Eligibility Matrix

| Scenario                                 | Deposit                      | App Fee |
| ---------------------------------------- | ---------------------------- | ------- |
| Non-winner (no violations)               | ✅ 100% Auto-refund (3 days) | ❌      |
| Withdrawal BEFORE deadline (`saleEndAt`) | ✅ 100%                      | ❌      |
| Withdrawal AFTER deadline                | ❌ Forfeited                 | ❌      |
| Winner payment default                   | ❌ Forfeited                 | ❌      |
| Check-in failure                         | ❌ Forfeited                 | ❌      |

---

## User Endpoints

### Request Refund (Manual)

Users can submit a manual refund request for expedited processing or early withdrawal.

**Endpoint:** `POST /request-refund`

**Authentication:** Required (Bidder)

**Request Body:**

```json
{
  "auctionId": "uuid",
  "reason": "Requesting deposit refund"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Refund request submitted successfully",
  "data": {
    "participantId": "uuid",
    "refundStatus": "pending",
    "refundRequestedAt": "2025-12-20T10:00:00.000Z",
    "depositAmount": 50000000,
    "applicationFee": 500000,
    "refundableAmount": 50000000,
    "eligibility": {
      "eligible": true,
      "refundPercentage": 100,
      "reason": "Eligible for full deposit refund"
    }
  }
}
```

**Error Responses:**

| Status | Message                      |
| ------ | ---------------------------- |
| 400    | Auction is not finalized yet |
| 400    | No deposit payment found     |
| 400    | Winners are not eligible     |
| 400    | Participant is disqualified  |
| 400    | Withdrew after deadline      |
| 404    | Participant not found        |

---

## Admin Endpoints

### List Refund Requests

**Endpoint:** `GET /admin/refunds`

**Query Parameters:**

| Parameter   | Type   | Description                                                                   |
| ----------- | ------ | ----------------------------------------------------------------------------- |
| `auctionId` | uuid   | Filter by auction                                                             |
| `status`    | string | `pending`, `approved`, `rejected`, `processed`, `forfeited`, `auto_processed` |
| `page`      | number | Page (default: 1)                                                             |
| `limit`     | number | Items (default: 20)                                                           |

### Update Refund Status

**Endpoint:** `PATCH /admin/refunds/:participantId`

**Actions:** `approve`, `reject`, `process`

### Batch Process Refunds

**Endpoint:** `POST /admin/refunds/batch/:auctionId`

Processes all eligible refunds for an auction at once.

---

## Deposit Forfeiture Reasons

| Code                  | Description (EN)          | Description (VI)    |
| --------------------- | ------------------------- | ------------------- |
| `NO_SHOW`             | Didn't attend auction     | Không tham gia      |
| `FALSE_INFORMATION`   | False registration info   | Khai báo sai        |
| `FORGED_DOCUMENTS`    | Forged documents          | Giả mạo hồ sơ       |
| `PRICE_RIGGING`       | Price manipulation        | Thông đồng dìm giá  |
| `AUCTION_OBSTRUCTION` | Obstructed auction        | Cản trở đấu giá     |
| `BID_WITHDRAWAL`      | Withdrew bid              | Rút lại giá         |
| `REFUSED_TO_SIGN`     | Refused to sign (2 days)  | Từ chối ký biên bản |
| `REFUSED_RESULT`      | Refused result            | Từ chối kết quả     |
| `PAYMENT_DEFAULT`     | Payment default (3 days)  | Không thanh toán    |
| `CONTRACT_DEFAULT`    | Contract default (7 days) | Vi phạm hợp đồng    |
| `CHECK_IN_FAILURE`    | No check-in               | Không điểm danh     |
| `LATE_WITHDRAWAL`     | Withdrew after deadline   | Rút sau hạn         |

---

## Refund Status Flow

```
┌─────────────────────────────────────────────────┐
│            AUTOMATIC REFUND PATH                │
│  (3 business days after finalization)           │
│                                                 │
│   Auction Ends → 3 Days → AUTO_PROCESSED        │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│            MANUAL REQUEST PATH                  │
│                                                 │
│   User Request → PENDING → APPROVED → PROCESSED │
│                     ↓                           │
│                  REJECTED                       │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│            FORFEITURE PATH                      │
│                                                 │
│   Disqualification → FORFEITED (no refund)      │
└─────────────────────────────────────────────────┘
```

---

## Email Notifications

1. **User**: Refund approved notification
2. **User**: Refund rejected (with reason)
3. **User**: Refund processed confirmation
4. **User**: Auto-refund processed notification

---

## Related

- [Registration Endpoints](./02_REGISTER_TO_BID.md)
- [Payment Endpoints](./04_FINALIZATION_PAYMENT.md)
