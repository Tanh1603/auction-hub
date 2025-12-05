# 🚀 Quick Test Setup Guide

This guide explains how to use the `quick-test-setup.ps1` script to bypass the two-tier approval process for testing purposes.

## 📋 Overview

The Auction Hub platform requires users to go through a **two-tier approval process** before they can place bids:

1. **Tier 1: Document Verification** - User submits documents, admin verifies them
2. **Tier 2: Deposit Payment** - User pays deposit, admin confirms payment
3. **Final Approval** - Admin gives final approval
4. **Check-in** - User checks in before auction starts

This script bypasses all these steps by directly modifying the database, **and generates a valid JWT token** for API authentication, making it ideal for WebSocket testing, API testing, or debugging.

## ⚡ Quick Start

### Step 1: Find Your User ID

```powershell
.\quick-test-setup.ps1 -ListUsers
```

This will display a list of users with their UUIDs:

```
                  id                  |        email         | full_name | role  | is_verified
--------------------------------------+----------------------+-----------+-------+-------------
 550e8400-e29b-41d4-a716-446655440000 | testuser@example.com | John Doe  | bidder| t
```

### Step 2: Run the Setup

```powershell
.\quick-test-setup.ps1 -UserId "550e8400-e29b-41d4-a716-446655440000"
```

That's it! The script will:

- ✅ Set up the user for bidding on auction **AUC001**
- ✅ Generate a **JWT token** (valid for 24 hours, copied to clipboard)
- ✅ Display all values needed for testing

### Step 3: Start Testing

**Option A: WebSocket Testing**

1. Open `websocket-full-test.html` in browser
2. Paste the JWT token (already in clipboard!)
3. Enter the Auction ID shown in the output
4. Connect and place bids!

**Option B: API Testing (Postman/curl)**

```bash
curl -X POST http://localhost:3000/api/manual-bid \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"auctionId": "<AUCTION_ID>", "amount": 2050000000}'
```

## 📖 Command Reference

### Basic Usage

| Command                                                     | Description                             |
| ----------------------------------------------------------- | --------------------------------------- |
| `.\quick-test-setup.ps1 -UserId <UUID>`                     | Setup user for AUC001 (default auction) |
| `.\quick-test-setup.ps1 -UserId <UUID> -AuctionCode AUC002` | Setup for a different auction           |

### List Commands

| Command                                    | Description                        |
| ------------------------------------------ | ---------------------------------- |
| `.\quick-test-setup.ps1 -ListUsers`        | List all users with their IDs      |
| `.\quick-test-setup.ps1 -ListAuctions`     | List all auctions with their codes |
| `.\quick-test-setup.ps1 -ListParticipants` | List all participant registrations |
| `.\quick-test-setup.ps1 -Help`             | Show detailed help message         |

### Parameters

| Parameter           | Type   | Required        | Default  | Description                   |
| ------------------- | ------ | --------------- | -------- | ----------------------------- |
| `-UserId`           | UUID   | Yes (for setup) | -        | The user's UUID               |
| `-AuctionCode`      | String | No              | `AUC001` | The auction code to setup for |
| `-ListUsers`        | Switch | No              | -        | List all users                |
| `-ListAuctions`     | Switch | No              | -        | List all auctions             |
| `-ListParticipants` | Switch | No              | -        | List all participants         |
| `-Help`             | Switch | No              | -        | Show help message             |

## 🔧 What the Script Does

When you run the setup, the script performs the following actions:

### 1. Auction Setup

- Fetches the auction by code (default: AUC001)
- Sets auction status to `live`
- Sets auction time window: started 1 hour ago, ends in 2 hours

### 2. Participant Registration

- Creates a new participant record if it doesn't exist
- If participant exists, updates the existing record

### 3. Two-Tier Approval Simulation

#### Tier 1: Document Verification

| Field                   | Value Set    | Description                                        |
| ----------------------- | ------------ | -------------------------------------------------- |
| `registered_at`         | 2 days ago   | Registration timestamp                             |
| `submitted_at`          | 2 days ago   | Document submission timestamp                      |
| `documents_verified_at` | 1.5 days ago | Tier 1 approval timestamp                          |
| `documents_verified_by` | User ID      | Admin who verified (uses same user for simplicity) |

#### Tier 2: Deposit Payment

| Field                | Value Set      | Description                                     |
| -------------------- | -------------- | ----------------------------------------------- |
| `deposit_paid_at`    | 1 day ago      | Payment timestamp                               |
| `deposit_amount`     | From auction   | Uses `deposit_amount_required` from the auction |
| `deposit_payment_id` | Generated UUID | Simulated payment reference                     |

#### Final Approval

| Field          | Value Set    | Description              |
| -------------- | ------------ | ------------------------ |
| `confirmed_at` | 12 hours ago | Final approval timestamp |
| `confirmed_by` | User ID      | Admin who approved       |

#### Check-in

| Field           | Value Set | Description        |
| --------------- | --------- | ------------------ |
| `checked_in_at` | Now       | Check-in timestamp |

### 4. Clear Rejection/Withdrawal Flags

The script clears these fields to ensure the user isn't blocked:

- `documents_rejected_at`
- `documents_rejected_reason`
- `rejected_at`
- `rejected_reason`
- `withdrawn_at`
- `withdrawal_reason`

### 5. JWT Token Generation

The script automatically generates a JWT token that:

- Uses the `SUPABASE_JWT_SECRET` from `server/.env`
- Is valid for **24 hours**
- Contains user info (id, email, full_name, role)
- Is automatically **copied to clipboard**
- Can be used directly in API requests or WebSocket connections

## 📊 Example Usage Scenarios

### Scenario 1: Quick WebSocket Testing

```powershell
# 1. List users to find your test user
.\quick-test-setup.ps1 -ListUsers

# 2. Setup the user for AUC001
.\quick-test-setup.ps1 -UserId "your-user-uuid-here"

# 3. Copy the auction ID from the output and use it in websocket-full-test.html
```

### Scenario 2: Testing Multiple Users

```powershell
# Setup multiple users for the same auction
.\quick-test-setup.ps1 -UserId "user1-uuid"
.\quick-test-setup.ps1 -UserId "user2-uuid"
.\quick-test-setup.ps1 -UserId "user3-uuid"

# Now all three users can bid on AUC001
```

### Scenario 3: Testing Different Auctions

```powershell
# First, list available auctions
.\quick-test-setup.ps1 -ListAuctions

# Setup user for a specific auction
.\quick-test-setup.ps1 -UserId "your-uuid" -AuctionCode "AUC002"
```

### Scenario 4: Verify Participant Status

```powershell
# Check all participants to verify setup
.\quick-test-setup.ps1 -ListParticipants
```

## 🔍 Understanding the Output

After running the setup, you'll see output like this:

```
=============================================
   QUICK TEST SETUP - Auction Hub
=============================================
User ID:      550e8400-e29b-41d4-a716-446655440000
Auction Code: AUC001
=============================================

[1/6] Fetching auction details for 'AUC001'...
  -> Found auction ID: ec1b7698-b101-4f6c-9bbd-434f44e1048a
  -> Deposit amount: 200000000.00 VND

[2/6] Verifying user exists...
  -> Found user: testuser@example.com
...
[7/7] Generating JWT Token...
  -> JWT Token generated successfully (valid for 24 hours)

=============================================
   SETUP COMPLETE!
   User is now ready to place bids on AUC001
=============================================

--- QUICK COPY VALUES ---

Auction ID:
ec1b7698-b101-4f6c-9bbd-434f44e1048a

User ID:
550e8400-e29b-41d4-a716-446655440000

JWT Token (Bearer):
eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI2MWZhZDU4NC...

Authorization Header:
Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...

[Copied JWT token to clipboard!]

--- NEXT STEPS ---
Option 1: WebSocket Testing
  1. Open websocket-full-test.html in browser
  2. Paste the JWT token in the 'JWT Token' field
  3. Enter Auction ID: ec1b7698-b101-4f6c-9bbd-434f44e1048a
  4. Connect and place bids!

Option 2: API Testing (Postman/curl)
  Add header: Authorization: Bearer <JWT_TOKEN>
  POST http://localhost:3000/api/manual-bid
  Body: { "auctionId": "ec1b7698-...", "amount": 2050000000 }
```

## ⚠️ Troubleshooting

### Error: "User with ID '...' not found!"

Make sure you're using the correct UUID format. Run:

```powershell
.\quick-test-setup.ps1 -ListUsers
```

### Error: "Auction with code '...' not found!"

Check available auctions:

```powershell
.\quick-test-setup.ps1 -ListAuctions
```

### Docker Connection Error

Make sure the PostgreSQL container is running:

```powershell
docker ps | findstr auction-hub-postgres
```

If not running, start the Docker containers:

```powershell
docker-compose up -d
```

### Permission Denied

Run PowerShell as Administrator or set execution policy:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## 📝 Notes

- This script is **for development/testing only**. Never use it in production.
- The script modifies database records directly, bypassing all validation.
- Timestamps are set to simulate a realistic approval timeline.
- The deposit amount is fetched from the auction's `deposit_amount_required` field.
- If the user is already registered, existing values are preserved (COALESCE is used).

## 🔗 Related Documentation

- [POSTMAN_API_TESTING_GUIDE.md](./POSTMAN_API_TESTING_GUIDE.md) - Complete API testing documentation
- [API_DOCUMENTATION/](./API_DOCUMENTATION/) - API documentation folder
- [websocket-full-test.html](./websocket-full-test.html) - WebSocket testing interface

## 📌 Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│                   QUICK TEST SETUP                          │
├─────────────────────────────────────────────────────────────┤
│ List users:      .\quick-test-setup.ps1 -ListUsers          │
│ List auctions:   .\quick-test-setup.ps1 -ListAuctions       │
│ Setup for AUC001: .\quick-test-setup.ps1 -UserId <UUID>     │
│ Setup for other:  .\quick-test-setup.ps1 -UserId <UUID>     │
│                   -AuctionCode AUC002                       │
│ Get help:        .\quick-test-setup.ps1 -Help               │
└─────────────────────────────────────────────────────────────┘
```
