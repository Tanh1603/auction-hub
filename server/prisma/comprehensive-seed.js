/* eslint-disable */
// Comprehensive seed file for testing complete auction flow
// Can be run in Docker container with: node comprehensive-seed.js

// This file requires the Prisma client to be available in the container
const { PrismaClient } = require('../generated/index.js');
const prisma = new PrismaClient();

console.log('🚀 Starting comprehensive auction seed...');

// Helper function to create dates relative to now
const createDate = (daysOffset, hoursOffset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  date.setHours(date.getHours() + hoursOffset);
  return date;
};

// Sample users for different roles
const sampleUsers = [
  {
    id: '0686d63e-dad4-41a1-8133-1c3a1b8e5a7d',
    email: 'auctioneer@company.com',
    fullName: 'Nguyễn Văn An',
    userType: 'business',
    phoneNumber: '+84901234567',
    identityNumber: 'DN001234567',
    taxId: '0123456789',
    isVerified: true,
    roleKey: 'auctioneer', // Use roleKey for internal logic
  },
  {
    id: '61fad584-3508-40b7-95cc-4e3f1a2b8c9d',
    email: 'bidder1@gmail.com',
    fullName: 'Trần Thị Bình',
    userType: 'individual',
    phoneNumber: '+84912345678',
    identityNumber: '123456789012',
    isVerified: true,
    roleKey: 'bidder',
  },
  {
    id: '731afa59-3c4a-4ff7-9cd7-8a2b5e4f6789',
    email: 'bidder2@gmail.com',
    fullName: 'Lê Văn Cường',
    userType: 'individual',
    phoneNumber: '+84923456789',
    identityNumber: '234567890123',
    isVerified: true,
    roleKey: 'bidder2',
  },
  {
    id: '7ebf139b-36ca-4fec-820b-9c1d3e5f7890',
    email: 'bidder3@gmail.com',
    fullName: 'Phạm Thị Dung',
    userType: 'business',
    phoneNumber: '+84934567890',
    identityNumber: 'DN987654321',
    taxId: '9876543210',
    isVerified: true,
    roleKey: 'bidder3',
  },
  {
    id: 'eb8544dd-2ecb-4b1d-84f5-c2a1b3e4f567',
    email: 'bidder4@gmail.com',
    fullName: 'Hoàng Văn Em',
    userType: 'individual',
    phoneNumber: '+84945678901',
    identityNumber: '345678901234',
    isVerified: true,
    roleKey: 'bidder4',
  },
  {
    id: 'ff5bd555-e284-456f-b648-a7c8d9e1f234',
    email: 'admin@auction.com',
    fullName: 'Quản trị viên',
    userType: 'business',
    phoneNumber: '+84956789012',
    identityNumber: 'AD001234567',
    isVerified: true,
    roleKey: 'admin',
  },
];

// Sample auctions for different scenarios
const sampleAuctions = [
  // Upcoming auction - registration open
  {
    code: 'AUC001',
    name: 'Căn hộ chung cư 80m2 - Quận 1',
    assetType: 'secured_asset',
    status: 'scheduled',
    saleStartAt: createDate(-2), // Started 2 days ago
    saleEndAt: createDate(3), // Ends in 3 days
    depositEndAt: createDate(2), // Deposit deadline in 2 days
    auctionStartAt: createDate(5), // Auction in 5 days
    auctionEndAt: createDate(5, 1), // 1 hour auction
    viewTime: 'Từ 8h-17h hàng ngày',
    saleFee: 500000,
    depositAmountRequired: 200000000, // 200 million VND
    startingPrice: 2000000000, // 2 billion VND
    bidIncrement: 50000000, // 50 million VND
    assetDescription:
      'Căn hộ chung cư cao cấp tại trung tâm thành phố, view đẹp, đầy đủ tiện nghi',
    assetAddress: '123 Nguyễn Huệ, Quận 1, TP.HCM',
    validCheckInBeforeStartMinutes: 30,
    validCheckInAfterStartMinutes: 15,
    hasMaxBidSteps: false,
    maxBidSteps: 0,
    isActive: true,
  },

  // Live auction - currently happening
  {
    code: 'AUC002',
    name: 'Xe ô tô Toyota Camry 2020',
    assetType: 'other_asset',
    status: 'live',
    saleStartAt: createDate(-10),
    saleEndAt: createDate(-3),
    depositEndAt: createDate(-3),
    auctionStartAt: createDate(0, -1), // Started 1 hour ago
    auctionEndAt: createDate(0, 1), // Ends in 1 hour
    viewTime: 'Từ 8h-17h tại showroom',
    saleFee: 200000,
    depositAmountRequired: 50000000, // 50 million VND
    startingPrice: 500000000, // 500 million VND
    bidIncrement: 10000000, // 10 million VND
    assetDescription: 'Xe Toyota Camry 2020, màu đen, máy 2.0L, đã đi 45,000km',
    assetAddress: 'Showroom ABC, Quận 7, TP.HCM',
    validCheckInBeforeStartMinutes: 30,
    validCheckInAfterStartMinutes: 15,
    hasMaxBidSteps: true,
    maxBidSteps: 20,
    isActive: true,
  },

  // Recently completed auction - successful
  {
    code: 'AUC003',
    name: 'Đất nền 500m2 - Quận 9',
    assetType: 'land_use_rights',
    status: 'success',
    saleStartAt: createDate(-20),
    saleEndAt: createDate(-10),
    depositEndAt: createDate(-10),
    auctionStartAt: createDate(-5),
    auctionEndAt: createDate(-5, 1),
    viewTime: 'Từ 8h-17h tại hiện trường',
    saleFee: 1000000,
    depositAmountRequired: 500000000, // 500 million VND
    startingPrice: 5000000000, // 5 billion VND
    bidIncrement: 100000000, // 100 million VND
    assetDescription:
      'Lô đất nền 500m2, mặt tiền đường lớn, thuận lợi xây dựng',
    assetAddress: 'Đường Võ Văn Ngân, Quận 9, TP.HCM',
    validCheckInBeforeStartMinutes: 30,
    validCheckInAfterStartMinutes: 15,
    hasMaxBidSteps: false,
    maxBidSteps: 0,
    isActive: true,
  },

  // Failed auction - no bids
  {
    code: 'AUC004',
    name: 'Máy móc cũ - Nhà máy ABC',
    assetType: 'state_asset',
    status: 'no_bid',
    saleStartAt: createDate(-30),
    saleEndAt: createDate(-20),
    depositEndAt: createDate(-20),
    auctionStartAt: createDate(-15),
    auctionEndAt: createDate(-15, 1),
    viewTime: 'Từ 8h-17h tại nhà máy',
    saleFee: 300000,
    depositAmountRequired: 100000000, // 100 million VND
    startingPrice: 1000000000, // 1 billion VND
    bidIncrement: 50000000, // 50 million VND
    assetDescription: 'Bộ máy móc sản xuất cũ, cần bảo dưỡng',
    assetAddress: 'KCN Tân Thuận, Quận 7, TP.HCM',
    validCheckInBeforeStartMinutes: 30,
    validCheckInAfterStartMinutes: 15,
    hasMaxBidSteps: false,
    maxBidSteps: 0,
    isActive: true,
  },

  // Future auction - registration not started yet
  {
    code: 'AUC005',
    name: 'Villa 2 tầng 300m2 - Thủ Đức',
    assetType: 'secured_asset',
    status: 'scheduled',
    saleStartAt: createDate(5),
    saleEndAt: createDate(15),
    depositEndAt: createDate(15),
    auctionStartAt: createDate(20),
    auctionEndAt: createDate(20, 2), // 2 hour auction
    viewTime: 'Cuối tuần từ 9h-16h',
    saleFee: 2000000,
    depositAmountRequired: 1000000000, // 1 billion VND
    startingPrice: 10000000000, // 10 billion VND
    bidIncrement: 200000000, // 200 million VND
    assetDescription:
      'Villa cao cấp 2 tầng, sân vườn rộng, nội thất sang trọng',
    assetAddress: 'KDC Riviera Point, TP. Thủ Đức',
    validCheckInBeforeStartMinutes: 45,
    validCheckInAfterStartMinutes: 30,
    hasMaxBidSteps: false,
    maxBidSteps: 0,
    isActive: true,
  },
];

// Images for auctions
const auctionImages = {
  AUC001: [
    'https://example.com/apartment1_main.jpg',
    'https://example.com/apartment1_living.jpg',
    'https://example.com/apartment1_bedroom.jpg',
    'https://example.com/apartment1_kitchen.jpg',
  ],
  AUC002: [
    'https://example.com/camry_exterior.jpg',
    'https://example.com/camry_interior.jpg',
    'https://example.com/camry_engine.jpg',
  ],
  AUC003: [
    'https://example.com/land_overview.jpg',
    'https://example.com/land_frontage.jpg',
  ],
  AUC004: [
    'https://example.com/machinery1.jpg',
    'https://example.com/machinery2.jpg',
  ],
  AUC005: [
    'https://example.com/villa_exterior.jpg',
    'https://example.com/villa_living.jpg',
    'https://example.com/villa_garden.jpg',
    'https://example.com/villa_pool.jpg',
  ],
};

// Attachments for auctions
const auctionAttachments = {
  AUC001: [
    { url: 'https://example.com/docs/apartment1_deed.pdf', type: 'document' },
    {
      url: 'https://example.com/docs/apartment1_inspection.pdf',
      type: 'document',
    },
  ],
  AUC002: [
    {
      url: 'https://example.com/docs/camry_registration.pdf',
      type: 'document',
    },
    { url: 'https://example.com/docs/camry_maintenance.pdf', type: 'document' },
  ],
  AUC003: [
    { url: 'https://example.com/docs/land_certificate.pdf', type: 'document' },
    { url: 'https://example.com/docs/land_survey.pdf', type: 'document' },
  ],
  AUC004: [
    { url: 'https://example.com/docs/machinery_specs.pdf', type: 'document' },
  ],
  AUC005: [
    { url: 'https://example.com/docs/villa_blueprint.pdf', type: 'document' },
    { url: 'https://example.com/docs/villa_valuation.pdf', type: 'document' },
    { url: 'https://example.com/videos/villa_tour.mp4', type: 'video' },
  ],
};

async function main() {
  try {
    await prisma.$connect();
    console.log('📦 Connected to database');

    // Clean existing data
    console.log('🧹 Cleaning existing data...');
    await prisma.$transaction([
      prisma.contract.deleteMany(),
      prisma.auctionAuditLog.deleteMany(),
      prisma.autoBidSetting.deleteMany(),
      prisma.auctionBid.deleteMany(),
      prisma.auctionParticipant.deleteMany(),
      prisma.auctionRelation.deleteMany(),
      prisma.auctionAttachment.deleteMany(),
      prisma.auctionImage.deleteMany(),
      prisma.auction.deleteMany(),
      prisma.user.deleteMany(),
    ]);

    // Create users
    console.log('👥 Creating users...');
    const users = {};
    for (const userData of sampleUsers) {
      // Extract roleKey for internal logic, don't send to Prisma
      const { roleKey, ...userDataForPrisma } = userData;

      const user = await prisma.user.create({
        data: {
          ...userDataForPrisma,
          updatedAt: new Date(),
        },
      });
      users[roleKey] = user;
      console.log(
        `  ✓ Created ${roleKey}: ${userData.fullName} (${userData.email})`
      );
    }

    // Create auctions
    console.log('🏛️ Creating auctions...');
    const auctions = {};
    for (const auctionData of sampleAuctions) {
      const auction = await prisma.auction.create({
        data: {
          ...auctionData,
          propertyOwner: users.auctioneer.id,
        },
      });
      auctions[auctionData.code] = auction;
      console.log(
        `  ✓ Created auction: ${auctionData.code} - ${auctionData.name}`
      );

      // Add images
      if (auctionImages[auctionData.code]) {
        const imageData = auctionImages[auctionData.code].map((url, index) => ({
          auctionId: auction.id,
          url,
          sortOrder: index,
        }));
        await prisma.auctionImage.createMany({ data: imageData });
        console.log(`    ✓ Added ${imageData.length} images`);
      }

      // Add attachments
      if (auctionAttachments[auctionData.code]) {
        const attachmentData = auctionAttachments[auctionData.code].map(
          (att) => ({
            auctionId: auction.id,
            url: att.url,
            type: att.type,
          })
        );
        await prisma.auctionAttachment.createMany({ data: attachmentData });
        console.log(`    ✓ Added ${attachmentData.length} attachments`);
      }
    }

    // Create participants and bids for different scenarios
    console.log('🙋‍♀️ Creating participants and bids...');

    // AUC001 - Upcoming auction with registrations
    const auc001Participants = [
      { user: users.bidder, status: 'confirmed' },
      { user: users.bidder2, status: 'confirmed' },
      { user: users.bidder3, status: 'submitted' },
      { user: users.bidder4, status: 'registered' },
    ];

    for (const { user, status } of auc001Participants) {
      const participantData = {
        userId: user.id,
        auctionId: auctions['AUC001'].id,
        registeredAt: createDate(-1),
      };

      if (status === 'submitted' || status === 'confirmed') {
        participantData.submittedAt = createDate(-1, 2);
      }
      if (status === 'confirmed') {
        participantData.confirmedAt = createDate(-1, 4);
      }

      const participant = await prisma.auctionParticipant.create({
        data: participantData,
      });
      console.log(
        `    ✓ Added participant ${user.fullName} to AUC001 (${status})`
      );
    }

    // AUC002 - Live auction with active bidding
    const auc002Participants = [
      { user: users.bidder, status: 'checked_in' },
      { user: users.bidder2, status: 'checked_in' },
      { user: users.bidder3, status: 'checked_in' },
    ];

    const auc002ParticipantIds = [];
    for (const { user, status } of auc002Participants) {
      const participant = await prisma.auctionParticipant.create({
        data: {
          userId: user.id,
          auctionId: auctions['AUC002'].id,
          registeredAt: createDate(-8),
          submittedAt: createDate(-7),
          confirmedAt: createDate(-6),
          checkedInAt: status === 'checked_in' ? createDate(0, -1) : null,
        },
      });
      auc002ParticipantIds.push({ id: participant.id, user });
      console.log(
        `    ✓ Added participant ${user.fullName} to AUC002 (${status})`
      );
    }

    // Create bids for live auction (AUC002)
    const bidSequence = [
      { participantIndex: 0, amount: 500000000, minutes: -50 }, // Starting bid
      { participantIndex: 1, amount: 510000000, minutes: -45 },
      { participantIndex: 2, amount: 520000000, minutes: -40 },
      { participantIndex: 0, amount: 530000000, minutes: -35 },
      { participantIndex: 1, amount: 540000000, minutes: -30 },
      { participantIndex: 0, amount: 550000000, minutes: -25 }, // Current highest
    ];

    for (let i = 0; i < bidSequence.length; i++) {
      const { participantIndex, amount, minutes } = bidSequence[i];
      const participant = auc002ParticipantIds[participantIndex];

      const bid = await prisma.auctionBid.create({
        data: {
          auctionId: auctions['AUC002'].id,
          participantId: participant.id,
          amount,
          bidAt: createDate(0, 0, minutes),
          bidType: 'manual',
          isWinningBid: i === bidSequence.length - 1, // Last bid is currently winning
        },
      });
      console.log(
        `    ✓ Bid ${i + 1}: ${
          participant.user.fullName
        } - ${amount.toLocaleString('vi-VN')} VND`
      );
    }

    // AUC003 - Completed auction with winner
    const auc003Participants = [
      { user: users.bidder, status: 'completed' },
      { user: users.bidder2, status: 'completed' },
      { user: users.bidder4, status: 'completed' },
    ];

    const auc003ParticipantIds = [];
    for (const { user } of auc003Participants) {
      const participant = await prisma.auctionParticipant.create({
        data: {
          userId: user.id,
          auctionId: auctions['AUC003'].id,
          registeredAt: createDate(-18),
          submittedAt: createDate(-17),
          confirmedAt: createDate(-15),
          checkedInAt: createDate(-5, -1),
        },
      });
      auc003ParticipantIds.push({ id: participant.id, user });
    }

    // Create completed bidding sequence for AUC003
    const auc003BidSequence = [
      { participantIndex: 0, amount: 5000000000, minutes: -55 },
      { participantIndex: 1, amount: 5100000000, minutes: -50 },
      { participantIndex: 2, amount: 5200000000, minutes: -45 },
      { participantIndex: 0, amount: 5300000000, minutes: -40 },
      { participantIndex: 1, amount: 5400000000, minutes: -35 },
      { participantIndex: 2, amount: 5500000000, minutes: -30 }, // Winner
    ];

    let winningBid = null;
    for (let i = 0; i < auc003BidSequence.length; i++) {
      const { participantIndex, amount, minutes } = auc003BidSequence[i];
      const participant = auc003ParticipantIds[participantIndex];

      const bid = await prisma.auctionBid.create({
        data: {
          auctionId: auctions['AUC003'].id,
          participantId: participant.id,
          amount,
          bidAt: createDate(-5, 0, minutes),
          bidType: 'manual',
          isWinningBid: i === auc003BidSequence.length - 1,
        },
      });

      if (i === auc003BidSequence.length - 1) {
        winningBid = bid;
      }
    }

    // Create contract for completed auction
    if (winningBid) {
      const contract = await prisma.contract.create({
        data: {
          auctionId: auctions['AUC003'].id,
          winningBidId: winningBid.id,
          sellerUserId: users.auctioneer.id,
          buyerUserId: auc003ParticipantIds[2].user.id, // Winner
          createdBy: users.admin.id,
          price: winningBid.amount,
          status: 'signed',
          signedAt: createDate(-3),
        },
      });
      console.log(
        `    ✓ Created contract for AUC003: ${winningBid.amount.toLocaleString(
          'vi-VN'
        )} VND`
      );
    }

    // Create auto-bid settings for some participants
    console.log('🤖 Creating auto-bid settings...');

    // Auto-bid for AUC002 (live auction)
    await prisma.autoBidSetting.create({
      data: {
        participantId: auc002ParticipantIds[1].id, // bidder2
        maxAmount: 600000000, // 600M VND max
        incrementAmount: 10000000, // 10M VND increment
        isActive: true,
      },
    });
    console.log(
      `    ✓ Auto-bid setting for ${auc002ParticipantIds[1].user.fullName} on AUC002`
    );

    // Create audit logs
    console.log('📋 Creating audit logs...');

    const auditLogs = [
      {
        auctionId: auctions['AUC001'].id,
        performedBy: users.admin.id,
        action: 'AUCTION_CREATED',
        reason: 'Phiên đấu giá mới được tạo',
        newStatus: 'scheduled',
      },
      {
        auctionId: auctions['AUC002'].id,
        performedBy: users.admin.id,
        action: 'STATUS_OVERRIDE',
        previousStatus: 'scheduled',
        newStatus: 'live',
        reason: 'Bắt đầu phiên đấu giá',
      },
      {
        auctionId: auctions['AUC003'].id,
        performedBy: users.admin.id,
        action: 'AUCTION_FINALIZED',
        previousStatus: 'live',
        newStatus: 'success',
        reason: 'Hoàn thành đấu giá thành công',
      },
      {
        auctionId: auctions['AUC003'].id,
        performedBy: users.admin.id,
        action: 'CONTRACT_CREATED',
        reason: 'Tạo hợp đồng cho người thắng đấu giá',
      },
    ];

    for (const logData of auditLogs) {
      await prisma.auctionAuditLog.create({ data: logData });
    }
    console.log(`    ✓ Created ${auditLogs.length} audit log entries`);

    // Create some auction relations
    console.log('🔗 Creating auction relations...');
    await prisma.auctionRelation.create({
      data: {
        auctionId: auctions['AUC001'].id,
        relatedAuctionId: auctions['AUC005'].id,
      },
    });
    console.log(`    ✓ Related AUC001 to AUC005 (similar properties)`);

    console.log('\n✅ Comprehensive seed completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   👥 Users: ${sampleUsers.length}`);
    console.log(`   🏛️ Auctions: ${sampleAuctions.length}`);
    console.log('   📸 Images: Added to all auctions');
    console.log('   📎 Attachments: Added to all auctions');
    console.log('   🙋‍♀️ Participants: Multiple per auction');
    console.log('   💰 Bids: Active bidding on live auction');
    console.log('   📄 Contracts: 1 signed contract');
    console.log('   🤖 Auto-bid: 1 active setting');
    console.log('   📋 Audit logs: 4 entries');
    console.log('   🔗 Relations: 1 auction relation');

    console.log('\n🎯 Test scenarios available:');
    console.log('   • AUC001: Registration open - test user registration flow');
    console.log('   • AUC002: Live auction - test bidding in real-time');
    console.log('   • AUC003: Completed - test post-auction contract flow');
    console.log('   • AUC004: Failed - test no-bid scenario');
    console.log('   • AUC005: Future - test upcoming auction preparation');

    console.log('\n📧 Email testing scenarios:');
    console.log('   • Registration confirmations');
    console.log('   • Bid notifications');
    console.log('   • Auction end notifications');
    console.log('   • Contract signing notifications');
    console.log('   • Winner notifications');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log('📦 Disconnected from database');
  }
}

// Run the seed
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
