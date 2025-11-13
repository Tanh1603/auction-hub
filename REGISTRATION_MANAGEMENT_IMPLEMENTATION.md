# Registration Management Implementation

This document describes the admin/auctioneer endpoints added to the register-to-bid feature for managing bidding registrations.

## Overview

Added comprehensive registration management functionality that allows admins and auctioneers to:
- **Approve** pending registrations
- **Reject** registrations with reasons (users can re-apply after rejection)
- **List** all registrations with pagination and filtering

## New Endpoints

### 1. List Registrations with Pagination
**Endpoint:** `GET /register-to-bid/admin/registrations`

**Access:** Admin, Auctioneer, Super Admin

**Query Parameters:**
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 10) - Items per page
- `status` (optional, default: "all") - Filter by status:
  - `all` - All registrations
  - `pending_review` - Submitted and awaiting approval
  - `confirmed` - Approved registrations
  - `rejected` - Rejected registrations
  - `withdrawn` - User-withdrawn registrations
- `auctionId` (optional) - Filter by specific auction

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "auctionId": "uuid",
      "registeredAt": "2024-01-01T00:00:00Z",
      "submittedAt": "2024-01-01T00:05:00Z",
      "confirmedAt": null,
      "rejectedAt": null,
      "rejectedReason": null,
      "checkedInAt": null,
      "withdrawnAt": null,
      "withdrawalReason": null,
      "currentState": "PENDING_REVIEW",
      "user": {
        "email": "user@example.com",
        "fullName": "John Doe",
        "phoneNumber": "+1234567890"
      },
      "auction": {
        "name": "Property Auction #123",
        "code": "AUC-2024-001"
      }
    }
  ],
  "pagination": {
    "currentPage": 1,
    "pageSize": 10,
    "totalItems": 50,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

### 2. Approve Registration
**Endpoint:** `POST /register-to-bid/admin/approve`

**Access:** Admin, Auctioneer, Super Admin

**Request Body:**
```json
{
  "participantId": "uuid"
}
```

**Response:** AuctionParticipantResponseDto with `confirmedAt` timestamp set

**Business Rules:**
- Registration must be in PENDING_REVIEW state
- Cannot approve already confirmed registrations
- Cannot approve withdrawn registrations
- Sets `confirmedAt` timestamp
- Clears any previous rejection data

### 3. Reject Registration
**Endpoint:** `POST /register-to-bid/admin/reject`

**Access:** Admin, Auctioneer, Super Admin

**Request Body:**
```json
{
  "participantId": "uuid",
  "rejectionReason": "Incomplete documentation" // optional
}
```

**Response:** AuctionParticipantResponseDto with `rejectedAt` timestamp and reason set

**Business Rules:**
- Registration must be in PENDING_REVIEW state
- Cannot reject already confirmed registrations
- Cannot reject withdrawn registrations
- Sets `rejectedAt` timestamp and rejection reason
- Users can re-apply after rejection (creates new submission)

## Registration State Flow

```
REGISTERED → PENDING_REVIEW → CONFIRMED → CHECKED_IN
                    ↓
                REJECTED (can re-apply)
                    ↓
              PENDING_REVIEW (resubmitted)

User can also: WITHDRAWN (can re-apply)
```

## Files Created

### DTOs
1. `dto/approve-registration.dto.ts` - DTO for approval requests
2. `dto/reject-registration.dto.ts` - DTO for rejection requests with reason
3. `dto/list-registrations-query.dto.ts` - Query parameters for listing with pagination
4. `dto/paginated-registrations-response.dto.ts` - Response structure for paginated results

### Service Methods
Added to `register-to-bid.service.ts`:
- `approveRegistration(dto)` - Approve a pending registration
- `rejectRegistration(dto)` - Reject a registration with reason
- `listRegistrations(query)` - List registrations with pagination and filtering

### Controller Endpoints
Added to `register-to-bid.controller.ts`:
- `GET /register-to-bid/admin/registrations` - List with pagination
- `POST /register-to-bid/admin/approve` - Approve registration
- `POST /register-to-bid/admin/reject` - Reject registration

## Security

All new endpoints are protected with:
- `@UseGuards(RolesGuard)` - Enforces role-based access
- `@Roles(UserRole.ADMIN, UserRole.AUCTIONEER, UserRole.SUPER_ADMIN)` - Only accessible by admins and auctioneers
- `@ApiBearerAuth()` - Requires JWT authentication

## Features

### Re-application Support
Users can re-apply after rejection or withdrawal:
- After **rejection**: User can submit a new registration for the same auction
- After **withdrawal**: User can re-register before the auction starts

### Pagination
- Efficient pagination with configurable page size
- Includes metadata: total items, total pages, navigation flags
- Default: 10 items per page

### Filtering
- By **status**: Show only pending, confirmed, rejected, or withdrawn registrations
- By **auction**: Show registrations for a specific auction
- Combine filters for targeted results

### User Information
Each registration includes:
- User email, full name, phone number
- Auction name and code
- Complete registration history (all timestamps)
- Current state derived from timestamps

## Testing

The implementation follows the existing testing patterns and can be tested using:
1. Postman/API client with admin/auctioneer JWT tokens
2. Integration tests (see `server/run-integration-tests.ps1`)

## Build Status

✅ Build successful - All TypeScript compilation passed
