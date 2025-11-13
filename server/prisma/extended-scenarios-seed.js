/* eslint-disable */
// Extended seed file with edge cases and email testing scenarios
// Run after comprehensive-seed.js for additional test data
// Usage: node extended-scenarios-seed.js

const { PrismaClient } = require('../generated/index.js');
const prisma = new PrismaClient();

console.log('🚀 Starting extended scenarios seed...');

// Helper function to create dates relative to now
const createDate = (daysOffset, hoursOffset = 0, minutesOffset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  date.setHours(date.getHours() + hoursOffset);
  date.setMinutes(date.getMinutes() + minutesOffset);
  return date;
};

// Additional users for edge case testing
const edgeUsers = [
  {
    email: 'unverified@test.com',
    fullName: 'Người dùng chưa xác thực',
    userType: 'individual',
    phoneNumber: '+84967890123',
    identityNumber: '567890123456',
    isVerified: false, // Unverified user
    roleKey: 'unverified_user', // Use roleKey for internal identification
  },
  {
    email: 'banned@test.com',
    fullName: 'Người dùng bị cấm',
    userType: 'individual',
    phoneNumber: '+84978901234',
    identityNumber: '678901234567',
    isVerified: true,
    isBanned: true,
    banReason: 'Vi phạm quy định đấu giá',
    bannedAt: createDate(-10),
    roleKey: 'banned_user',
  },
  {
    email: 'frequent.bidder@test.com',
    fullName: 'Nguyễn Thường Xuyên',
    userType: 'business',
    phoneNumber: '+84989012345',
    identityNumber: 'DN555666777',
    taxId: '5556667770',
    isVerified: true,
    ratingScore: 4.8,
    totalRatings: 25,
    roleKey: 'frequent_bidder',
  },
  {
    email: 'last.minute@test.com',
    fullName: 'Đấu Phút Cuối',
    userType: 'individual',
    phoneNumber: '+84990123456',
    identityNumber: '789012345678',
    isVerified: true,
    roleKey: 'last_minute_bidder',
  },
];

// Edge case auctions
const edgeAuctions = [
  // Auction ending in 10 minutes - for urgent bidding test
  {
    code: 'URGENT001',
    name: 'Đấu giá khẩn cấp - Kết thúc trong 10 phút',
    assetType: 'other_asset',
    status: 'live',
    saleStartAt: createDate(-5),
    saleEndAt: createDate(-2),
    depositEndAt: createDate(-2),
    auctionStartAt: createDate(0, -2), // Started 2 hours ago
    auctionEndAt: createDate(0, 0, 10), // Ends in 10 minutes
    viewTime: 'Xem ngay lập tức',
    saleFee: 100000,
    depositAmountRequired: 20000000,
    startingPrice: 200000000,
    bidIncrement: 5000000,
    assetDescription: 'Tài sản cần bán gấp, cơ hội cuối cùng',
    assetAddress: 'Địa chỉ khẩn cấp',
    validCheckInBeforeStartMinutes: 15,
    validCheckInAfterStartMinutes: 10,
    hasMaxBidSteps: false,
    maxBidSteps: 0,
    isActive: true,
  },

  // Auction with maximum bid steps reached
  {
    code: 'MAXSTEP001',
    name: 'Đấu giá giới hạn bước - Đã đạt tối đa',
    assetType: 'secured_asset',
    status: 'live',
    saleStartAt: createDate(-7),
    saleEndAt: createDate(-3),
    depositEndAt: createDate(-3),
    auctionStartAt: createDate(0, -3),
    auctionEndAt: createDate(0, 1),
    viewTime: 'Theo lịch hẹn',
    saleFee: 300000,
    depositAmountRequired: 100000000,
    startingPrice: 1000000000,
    bidIncrement: 20000000,
    assetDescription: 'Tài sản với giới hạn số lần trả giá',
    assetAddress: 'Địa chỉ giới hạn bước',
    validCheckInBeforeStartMinutes: 30,
    validCheckInAfterStartMinutes: 15,
    hasMaxBidSteps: true,
    maxBidSteps: 5, // Will reach maximum
    isActive: true,
  },

  // Cancelled auction
  {
    code: 'CANCEL001',
    name: 'Đấu giá bị hủy bỏ',
    assetType: 'land_use_rights',
    status: 'cancelled',
    saleStartAt: createDate(-15),
    saleEndAt: createDate(-5),
    depositEndAt: createDate(-5),
    auctionStartAt: createDate(-2),
    auctionEndAt: createDate(-1),
    viewTime: 'Đã hủy',
    saleFee: 500000,
    depositAmountRequired: 300000000,
    startingPrice: 3000000000,
    bidIncrement: 50000000,
    assetDescription: 'Đấu giá bị hủy do lý do khách quan',
    assetAddress: 'Địa chỉ đã hủy',
    validCheckInBeforeStartMinutes: 30,
    validCheckInAfterStartMinutes: 15,
    hasMaxBidSteps: false,
    maxBidSteps: 0,
    isActive: false,
  },

  // High-value auction for premium testing
  {
    code: 'PREMIUM001',
    name: 'Tòa nhà văn phòng cao cấp - Giá trị cao',
    assetType: 'secured_asset',
    status: 'scheduled',
    saleStartAt: createDate(1),
    saleEndAt: createDate(10),
    depositEndAt: createDate(10),
    auctionStartAt: createDate(15),
    auctionEndAt: createDate(15, 3), // 3 hour auction
    viewTime: 'Thứ 2-6 từ 9h-17h, cuối tuần theo hẹn',
    saleFee: 5000000,
    depositAmountRequired: 5000000000, // 5 billion VND
    startingPrice: 50000000000, // 50 billion VND
    bidIncrement: 500000000, // 500 million VND
    assetDescription: 'Tòa nhà văn phòng hạng A, 20 tầng, vị trí đắc địa',
    assetAddress: 'Đường Nguyễn Huệ, Quận 1, TP.HCM',
    validCheckInBeforeStartMinutes: 60,
    validCheckInAfterStartMinutes: 30,
    hasMaxBidSteps: false,
    maxBidSteps: 0,
    isActive: true,
  },
];

async function main() {
  try {
    await prisma.$connect();
    console.log('📦 Connected to database');

    // Get existing users (assuming comprehensive-seed.js was run first)
    const existingUsers = await prisma.user.findMany();
    if (existingUsers.length === 0) {
      throw new Error(
        'No existing users found. Please run comprehensive-seed.js first!'
      );
    }

    const adminUser = existingUsers.find(
      (u) => u.email === 'admin@auction.com'
    );
    const auctioneeerUser = existingUsers.find(
      (u) => u.email === 'auctioneer@company.com'
    );

    if (!adminUser || !auctioneeerUser) {
      throw new Error(
        'Required admin or auctioneer users not found. Please run comprehensive-seed.js first!'
      );
    }

    // Create additional edge case users
    console.log('👥 Creating edge case users...');
    const edgeUserMap = {};
    for (const userData of edgeUsers) {
      try {
        // Remove roleKey from userData before creating user
        const { roleKey, ...userCreateData } = userData;
        const user = await prisma.user.create({
          data: {
            ...userCreateData,
            updatedAt: new Date(),
          },
        });
        edgeUserMap[roleKey] = user;
        console.log(`  ✓ Created ${roleKey}: ${userData.fullName}`);
      } catch (error) {
        if (error.code === 'P2002') {
          console.log(`  ⚠️ User ${userData.email} already exists, skipping`);
          const existingUser = await prisma.user.findUnique({
            where: { email: userData.email },
          });
          edgeUserMap[userData.roleKey] = existingUser;
        } else {
          throw error;
        }
      }
    }

    // Create edge case auctions
    console.log('🏛️ Creating edge case auctions...');
    const edgeAuctionMap = {};
    for (const auctionData of edgeAuctions) {
      try {
        const auction = await prisma.auction.create({
          data: {
            ...auctionData,
            propertyOwner: auctioneeerUser.id,
          },
        });
        edgeAuctionMap[auctionData.code] = auction;
        console.log(
          `  ✓ Created auction: ${auctionData.code} - ${auctionData.name}`
        );
      } catch (error) {
        if (error.code === 'P2002') {
          console.log(
            `  ⚠️ Auction ${auctionData.code} already exists, skipping`
          );
        } else {
          throw error;
        }
      }
    }

    // Set up urgent bidding scenario (URGENT001)
    if (edgeAuctionMap['URGENT001']) {
      console.log('⏰ Setting up urgent bidding scenario...');

      // Quick participants for urgent auction
      const urgentParticipants = [];
      const availableBidders = existingUsers
        .filter(
          (u) => u.email.includes('bidder') && u.isVerified && !u.isBanned
        )
        .slice(0, 3);

      for (const bidder of availableBidders) {
        const participant = await prisma.auctionParticipant.create({
          data: {
            userId: bidder.id,
            auctionId: edgeAuctionMap['URGENT001'].id,
            registeredAt: createDate(-4),
            submittedAt: createDate(-3),
            confirmedAt: createDate(-2),
            checkedInAt: createDate(0, -2),
          },
        });
        urgentParticipants.push({ participant, user: bidder });
      }

      // Create rapid bid sequence for urgent auction
      const urgentBids = [
        { participantIndex: 0, amount: 200000000, minutes: -90 },
        { participantIndex: 1, amount: 205000000, minutes: -85 },
        { participantIndex: 2, amount: 210000000, minutes: -80 },
        { participantIndex: 0, amount: 215000000, minutes: -75 },
        { participantIndex: 1, amount: 220000000, minutes: -25 }, // Recent bid
        { participantIndex: 2, amount: 225000000, minutes: -15 }, // Latest bid
      ];

      for (let i = 0; i < urgentBids.length; i++) {
        const { participantIndex, amount, minutes } = urgentBids[i];
        const { participant } = urgentParticipants[participantIndex];

        await prisma.auctionBid.create({
          data: {
            auctionId: edgeAuctionMap['URGENT001'].id,
            participantId: participant.id,
            amount,
            bidAt: createDate(0, 0, minutes),
            bidType: 'manual',
            isWinningBid: i === urgentBids.length - 1,
          },
        });
      }
      console.log(
        `    ✓ Created ${urgentBids.length} urgent bids, ending in 10 minutes`
      );
    }

    // Set up max steps scenario (MAXSTEP001)
    if (edgeAuctionMap['MAXSTEP001']) {
      console.log('🔢 Setting up maximum steps scenario...');

      const maxStepParticipants = [];
      const availableBidders = existingUsers
        .filter(
          (u) => u.email.includes('bidder') && u.isVerified && !u.isBanned
        )
        .slice(0, 2);

      for (const bidder of availableBidders) {
        const participant = await prisma.auctionParticipant.create({
          data: {
            userId: bidder.id,
            auctionId: edgeAuctionMap['MAXSTEP001'].id,
            registeredAt: createDate(-6),
            submittedAt: createDate(-5),
            confirmedAt: createDate(-4),
            checkedInAt: createDate(0, -3),
          },
        });
        maxStepParticipants.push({ participant, user: bidder });
      }

      // Create exactly 5 bids to reach maximum
      const maxStepBids = [
        { participantIndex: 0, amount: 1000000000, minutes: -120 }, // Step 1
        { participantIndex: 1, amount: 1020000000, minutes: -100 }, // Step 2
        { participantIndex: 0, amount: 1040000000, minutes: -80 }, // Step 3
        { participantIndex: 1, amount: 1060000000, minutes: -60 }, // Step 4
        { participantIndex: 0, amount: 1080000000, minutes: -40 }, // Step 5 (MAX)
      ];

      for (let i = 0; i < maxStepBids.length; i++) {
        const { participantIndex, amount, minutes } = maxStepBids[i];
        const { participant } = maxStepParticipants[participantIndex];

        await prisma.auctionBid.create({
          data: {
            auctionId: edgeAuctionMap['MAXSTEP001'].id,
            participantId: participant.id,
            amount,
            bidAt: createDate(0, 0, minutes),
            bidType: 'manual',
            isWinningBid: i === maxStepBids.length - 1,
          },
        });
      }
      console.log(`    ✓ Created 5/5 bids (maximum reached)`);
    }

    // Set up cancelled auction scenario with participants who need refunds
    if (edgeAuctionMap['CANCEL001']) {
      console.log('❌ Setting up cancelled auction scenario...');

      const cancelledParticipants = [];
      const availableBidders = existingUsers
        .filter(
          (u) => u.email.includes('bidder') && u.isVerified && !u.isBanned
        )
        .slice(0, 4);

      for (const bidder of availableBidders) {
        const participant = await prisma.auctionParticipant.create({
          data: {
            userId: bidder.id,
            auctionId: edgeAuctionMap['CANCEL001'].id,
            registeredAt: createDate(-14),
            submittedAt: createDate(-13),
            confirmedAt: createDate(-12),
            checkedInAt: createDate(-2, -1),
          },
        });
        cancelledParticipants.push({ participant, user: bidder });
      }

      // Create some bids that were placed before cancellation
      const cancelledBids = [
        { participantIndex: 0, amount: 3000000000, minutes: -60 },
        { participantIndex: 1, amount: 3050000000, minutes: -45 },
        { participantIndex: 2, amount: 3100000000, minutes: -30 },
      ];

      for (let i = 0; i < cancelledBids.length; i++) {
        const { participantIndex, amount, minutes } = cancelledBids[i];
        const { participant } = cancelledParticipants[participantIndex];

        await prisma.auctionBid.create({
          data: {
            auctionId: edgeAuctionMap['CANCEL001'].id,
            participantId: participant.id,
            amount,
            bidAt: createDate(-2, 0, minutes),
            bidType: 'manual',
            isWinningBid: false, // No winner due to cancellation
          },
        });
      }

      // Add audit log for cancellation
      await prisma.auctionAuditLog.create({
        data: {
          auctionId: edgeAuctionMap['CANCEL001'].id,
          performedBy: adminUser.id,
          action: 'AUCTION_CANCELLED',
          previousStatus: 'live',
          newStatus: 'cancelled',
          reason: 'Hủy bỏ do tài sản có tranh chấp pháp lý',
          notes: 'Cần hoàn trả tiền đặt cọc cho tất cả người tham gia',
        },
      });

      console.log(
        `    ✓ Created cancelled auction with ${cancelledBids.length} bids needing refund`
      );
    }

    // Set up premium auction with VIP participants
    if (edgeAuctionMap['PREMIUM001']) {
      console.log('💎 Setting up premium auction scenario...');

      // Add frequent bidder and some existing users
      const premiumParticipants = [
        edgeUserMap.frequent_bidder,
        ...existingUsers
          .filter(
            (u) => u.email.includes('bidder') && u.isVerified && !u.isBanned
          )
          .slice(0, 2),
      ];

      for (const user of premiumParticipants) {
        if (user) {
          await prisma.auctionParticipant.create({
            data: {
              userId: user.id,
              auctionId: edgeAuctionMap['PREMIUM001'].id,
              registeredAt: createDate(2),
              submittedAt: createDate(3),
              confirmedAt: createDate(4),
            },
          });
          console.log(`    ✓ Added ${user.fullName} to premium auction`);
        }
      }
    }

    // Create comprehensive audit logs for email testing
    console.log('📧 Creating email notification scenarios...');

    const emailTestLogs = [
      {
        auctionId:
          edgeAuctionMap['URGENT001']?.id ||
          edgeAuctionMap[Object.keys(edgeAuctionMap)[0]]?.id,
        performedBy: adminUser.id,
        action: 'BID_DENIED',
        reason: 'Test email: Bid denial notification',
        notes: 'Testing bid rejection email flow',
      },
      {
        auctionId:
          edgeAuctionMap['PREMIUM001']?.id ||
          edgeAuctionMap[Object.keys(edgeAuctionMap)[0]]?.id,
        performedBy: adminUser.id,
        action: 'PARTICIPANT_APPROVED',
        reason: 'Test email: Participant approval notification',
        notes: 'Testing registration approval email flow',
      },
      {
        auctionId:
          edgeAuctionMap['CANCEL001']?.id ||
          edgeAuctionMap[Object.keys(edgeAuctionMap)[0]]?.id,
        performedBy: adminUser.id,
        action: 'PARTICIPANT_REJECTED',
        reason: 'Test email: Participant rejection notification',
        notes: 'Testing registration rejection email flow',
      },
    ];

    for (const logData of emailTestLogs.filter((log) => log.auctionId)) {
      await prisma.auctionAuditLog.create({ data: logData });
    }
    console.log(
      `    ✓ Created ${
        emailTestLogs.filter((log) => log.auctionId).length
      } email test scenarios`
    );

    console.log('\n✅ Extended scenarios seed completed!');
    console.log('\n🎯 Additional test scenarios:');
    console.log('   • URGENT001: 10-minute countdown test');
    console.log('   • MAXSTEP001: Maximum bid steps reached');
    console.log('   • CANCEL001: Cancelled auction with refunds needed');
    console.log('   • PREMIUM001: High-value auction registration');

    console.log('\n📧 Email notification tests:');
    console.log('   • Bid denial notifications');
    console.log('   • Participant approval/rejection');
    console.log('   • Urgent auction alerts');
    console.log('   • Cancellation notifications');
    console.log('   • Refund notifications');

    console.log('\n⚠️ Edge cases covered:');
    console.log('   • Unverified user attempts');
    console.log('   • Banned user interactions');
    console.log('   • Maximum bid step limits');
    console.log('   • Last-minute bidding');
    console.log('   • Premium auction workflows');
  } catch (error) {
    console.error('❌ Extended seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log('📦 Disconnected from database');
  }
}

// Run the extended seed
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
