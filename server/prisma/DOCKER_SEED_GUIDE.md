# Docker Seed Execution Guide

## Overview

These seed files create comprehensive test data for thorough auction system testing, including the complete flow from registration to bidding to finalization and email notifications.

## Files Created

### 1. `comprehensive-seed.js`

- **Main seed file** with core auction scenarios
- Creates 6 users (auctioneer, bidders, admin)
- Creates 5 auctions in different states:
  - **AUC001**: Upcoming auction (registration open)
  - **AUC002**: Live auction (currently bidding)
  - **AUC003**: Completed auction (with signed contract)
  - **AUC004**: Failed auction (no bids)
  - **AUC005**: Future auction (registration not started)

### 2. `extended-scenarios-seed.js`

- **Extended test scenarios** for edge cases
- Additional users (unverified, banned, frequent bidder)
- Edge case auctions:
  - **URGENT001**: Ends in 10 minutes (urgent bidding)
  - **MAXSTEP001**: Maximum bid steps reached
  - **CANCEL001**: Cancelled auction needing refunds
  - **PREMIUM001**: High-value premium auction

### 3. `run-seeds-docker.sh`

- Bash script for easy Docker execution
- Runs both seed files in sequence
- Interactive prompts for user choice

## Docker Execution Methods

### Method 1: Using the Bash Script (Recommended)

```bash
# Make script executable (Linux/Mac)
chmod +x server/prisma/run-seeds-docker.sh

# Run the script
./server/prisma/run-seeds-docker.sh
```

### Method 2: Manual Docker Commands

```bash
# Copy files to Docker container
docker cp server/prisma/comprehensive-seed.js auction-hub-server-1:/app/prisma/
docker cp server/prisma/extended-scenarios-seed.js auction-hub-server-1:/app/prisma/

# Run comprehensive seed
docker exec -it auction-hub-server-1 node prisma/comprehensive-seed.js

# Run extended scenarios (optional)
docker exec -it auction-hub-server-1 node prisma/extended-scenarios-seed.js
```

### Method 3: Interactive Docker Session

```bash
# Enter Docker container
docker exec -it auction-hub-server-1 bash

# Inside container, run seeds
node prisma/comprehensive-seed.js
node prisma/extended-scenarios-seed.js
```

## Testing Scenarios Available

### 1. User Registration Flow

- **AUC001** (Upcoming auction)
- Test user registration, document submission, approval process
- Users at different registration stages

### 2. Live Bidding Flow

- **AUC002** (Live auction with active bids)
- Test real-time bidding, auto-bidding, bid validation
- **URGENT001** (Ends in 10 minutes for urgent testing)

### 3. Auction Completion Flow

- **AUC003** (Completed with signed contract)
- Test winner determination, contract creation, notifications

### 4. Edge Cases

- **MAXSTEP001**: Test maximum bid step limits
- **CANCEL001**: Test cancellation and refund processes
- Unverified/banned user interactions

### 5. Email Notification Testing

All scenarios include audit logs that trigger various email types:

- Registration confirmations
- Bid notifications
- Winner announcements
- Cancellation notices
- Contract signing alerts

## Data Overview

### Users Created

- **Auctioneer**: Property owner/seller
- **Admin**: System administrator
- **4 Bidders**: Various verification states
- **Edge case users**: Unverified, banned, frequent bidder

### Complete Auction States

- **Scheduled**: Registration open/closed
- **Live**: Active bidding in progress
- **Success**: Completed with winner
- **No bid**: Failed auctions
- **Cancelled**: Cancelled with refunds needed

### Bidding Scenarios

- Manual bidding sequences
- Auto-bidding configurations
- Winning/losing bid scenarios
- Bid denials and withdrawals

## Verification Commands

After running seeds, verify data with:

```bash
# Check created data
docker exec -it auction-hub-server-1 npx prisma studio

# Or query directly
docker exec -it auction-hub-server-1 node -e "
const { PrismaClient } = require('./generated/index.js');
const prisma = new PrismaClient();
prisma.user.count().then(count => console.log('Users:', count));
prisma.auction.count().then(count => console.log('Auctions:', count));
prisma.auctionBid.count().then(count => console.log('Bids:', count));
"
```

## File Dependencies

- Both seed files require Prisma client at `./generated/index.js`
- `extended-scenarios-seed.js` should be run AFTER `comprehensive-seed.js`
- Files are designed to handle existing data gracefully

## Notes

- All dates are relative to current time for realistic testing
- Vietnamese names and descriptions for localization testing
- Comprehensive audit logs for email notification testing
- Edge cases cover real-world auction scenarios
- Data is structured for complete flow testing from registration to contract signing
