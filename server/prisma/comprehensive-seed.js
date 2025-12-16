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
    role: 'auctioneer',
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
    role: 'bidder',
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
    role: 'bidder',
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
    role: 'bidder',
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
    role: 'bidder',
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
    role: 'admin',
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
    assetWardId: 15,
    assetProvinceId: 7,
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
    assetWardId: 57,
    assetProvinceId: 7,
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
    assetWardId: 54,
    assetProvinceId: 7,
  },

  // Failed auction - no bids
  {
    code: 'AUC004',
    name: 'Máy móc cũ - Nhà máy ABC',
    assetType: 'state_asset',
    status: 'failed',
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
    assetWardId: 56,
    assetProvinceId: 7,
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
    assetWardId: 22,
    assetProvinceId: 7,
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

    // Check if data already exists
    const existingUserCount = await prisma.user.count();
    const existingAuctionCount = await prisma.auction.count();

    if (existingUserCount > 0 || existingAuctionCount > 0) {
      console.log('✅ Database already contains data:');
      console.log(`   👥 Users: ${existingUserCount}`);
      console.log(`   🏛️ Auctions: ${existingAuctionCount}`);
      console.log('⏭️  Skipping seed to preserve existing data');
      console.log('💡 To reseed, manually clear the database first');
      return; // Exit early - don't proceed to cleaning or seeding
    }

    // Clean existing data (only runs if database is empty)
    console.log('🧹 Database is empty, proceeding with seed...');

    // ========================================
    // SEED SYSTEM VARIABLES FIRST
    // ========================================
    console.log('\n⚙️  Seeding system variables...');

    const systemVariables = [
      // Deposit variables
      {
        category: 'deposit',
        key: 'deposit.general.min_percentage',
        value: '5',
        dataType: 'number',
        description: 'Minimum deposit % for general assets (Circular 48/2017)',
      },
      {
        category: 'deposit',
        key: 'deposit.general.max_percentage',
        value: '20',
        dataType: 'number',
        description: 'Maximum deposit % for general assets (Circular 48/2017)',
      },
      {
        category: 'deposit',
        key: 'deposit.land.min_percentage',
        value: '10',
        dataType: 'number',
        description: 'Minimum deposit % for land use rights (Circular 48/2017)',
      },
      {
        category: 'deposit',
        key: 'deposit.land.max_percentage',
        value: '20',
        dataType: 'number',
        description: 'Maximum deposit % for land use rights (Circular 48/2017)',
      },
      {
        category: 'deposit',
        key: 'deposit.min_amount',
        value: '1000000',
        dataType: 'number',
        description: 'Absolute minimum deposit amount in VND',
      },
      {
        category: 'deposit',
        key: 'deposit.deadline_hours',
        value: '24',
        dataType: 'number',
        description:
          'Hours before auction start to pay deposit (Circular 48/2017)',
      },
      {
        category: 'deposit',
        key: 'deposit.refund_deadline_days',
        value: '3',
        dataType: 'number',
        description:
          'Working days to process deposit refund (Circular 48/2017)',
      },
      {
        category: 'deposit',
        key: 'deposit.requires_documents',
        value: 'true',
        dataType: 'boolean',
        description: 'Whether documents are required for deposit payment',
      },

      // Commission variables
      {
        category: 'commission',
        key: 'commission.min_amount',
        value: '1000000',
        dataType: 'number',
        description:
          'Minimum commission amount in VND (Circular 45/2017, 108/2020)',
      },
      {
        category: 'commission',
        key: 'commission.max_amount',
        value: '400000000',
        dataType: 'number',
        description:
          'Maximum commission amount in VND (Circular 45/2017, 108/2020)',
      },

      // Dossier fee variables
      {
        category: 'dossier',
        key: 'dossier.tier1_max',
        value: '200000000',
        dataType: 'number',
        description:
          'Tier 1 starting price limit (up to 200M VND) - Circular 48/2017',
      },
      {
        category: 'dossier',
        key: 'dossier.tier1_fee',
        value: '100000',
        dataType: 'number',
        description:
          'Tier 1 maximum dossier fee (100,000 VND) - Circular 48/2017',
      },
      {
        category: 'dossier',
        key: 'dossier.tier2_max',
        value: '500000000',
        dataType: 'number',
        description:
          'Tier 2 starting price limit (200M-500M VND) - Circular 48/2017',
      },
      {
        category: 'dossier',
        key: 'dossier.tier2_fee',
        value: '200000',
        dataType: 'number',
        description:
          'Tier 2 maximum dossier fee (200,000 VND) - Circular 48/2017',
      },
      {
        category: 'dossier',
        key: 'dossier.tier3_fee',
        value: '500000',
        dataType: 'number',
        description:
          'Tier 3+ maximum dossier fee (500,000 VND, 500M+ starting price) - Circular 48/2017',
      },

      // General variables
      {
        category: 'general',
        key: 'general.currency',
        value: 'VND',
        dataType: 'string',
        description: 'System currency code',
      },
      {
        category: 'general',
        key: 'general.timezone',
        value: 'Asia/Ho_Chi_Minh',
        dataType: 'string',
        description: 'System timezone',
      },
      {
        category: 'general',
        key: 'general.vat_rate',
        value: '0.1',
        dataType: 'number',
        description: 'VAT rate (10%)',
      },
    ];

    for (const variable of systemVariables) {
      await prisma.systemVariable.upsert({
        where: {
          category_key: {
            category: variable.category,
            key: variable.key,
          },
        },
        create: variable,
        update: { value: variable.value },
      });
    }

    // ========================================
    // SEED LOCATION DATA
    // ========================================
    console.log('\n📍 Seeding location data...');

    // Hardcoded minimal location data for seed script
    // This includes only the locations needed for sample auctions
    const locations = [
      // Province - An Giang (ID 7 as parent)
      {
        id: 7,
        name: 'An Giang',
        value: 30000,
        sortOrder: 1,
        parentId: null,
      },
      // Wards/Districts in An Giang province
      {
        id: 15,
        name: 'Bình Đức',
        value: 30292,
        sortOrder: 8,
        parentId: 7,
      },
      {
        id: 57,
        name: 'Mỹ Thới',
        value: 30301,
        sortOrder: 50,
        parentId: 7,
      },
      {
        id: 54,
        name: 'Long Xuyên',
        value: 30307,
        sortOrder: 47,
        parentId: 7,
      },
      {
        id: 56,
        name: 'Mỹ Hòa Hưng',
        value: 30313,
        sortOrder: 49,
        parentId: 7,
      },
      {
        id: 22,
        name: 'Châu Đốc',
        value: 30316,
        sortOrder: 15,
        parentId: 7,
      },
    ];

    await prisma.location.createMany({
      data: locations,
      skipDuplicates: true,
    });

    console.log(`  ✓ Created ${locations.length} locations`);

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
      // Prepare images data
      let imagesData = [];
      if (auctionImages[auctionData.code]) {
        imagesData = auctionImages[auctionData.code].map((url, index) => ({
          url,
          sortOrder: index,
        }));
      }

      // Prepare attachments data
      let attachmentsData = [];
      if (auctionAttachments[auctionData.code]) {
        attachmentsData = auctionAttachments[auctionData.code].map((att) => ({
          url: att.url,
          type: att.type,
        }));
      }

      const auction = await prisma.auction.create({
        data: {
          ...auctionData,
          propertyOwner: users.auctioneer.id,
          images: imagesData.length > 0 ? imagesData : undefined,
          attachments: attachmentsData.length > 0 ? attachmentsData : undefined,
        },
      });
      auctions[auctionData.code] = auction;
      console.log(
        `  ✓ Created auction: ${auctionData.code} - ${auctionData.name}`
      );

      if (imagesData.length > 0) {
        console.log(`    ✓ Added ${imagesData.length} images`);
      }
      if (attachmentsData.length > 0) {
        console.log(`    ✓ Added ${attachmentsData.length} attachments`);
      }
    }

    // Create participants and bids for different scenarios
    console.log('🙋‍♀️ Creating participants and bids...');

    // AUC001 - Upcoming auction with registrations (Two-Tier Approval System)
    const auc001Participants = [
      {
        user: users.bidder,
        status: 'confirmed', // Fully approved (Tier 1 + Tier 2)
        documentUrls: [
          {
            type: 'identity_card',
            url: 'https://example.com/docs/bidder1_id.pdf',
          },
          {
            type: 'financial_proof',
            url: 'https://example.com/docs/bidder1_bank.pdf',
          },
        ],
      },
      {
        user: users.bidder2,
        status: 'deposit_paid', // Documents verified, deposit paid, awaiting final approval
        documentUrls: [
          {
            type: 'identity_card',
            url: 'https://example.com/docs/bidder2_id.pdf',
          },
          {
            type: 'financial_proof',
            url: 'https://example.com/docs/bidder2_bank.pdf',
          },
        ],
      },
      {
        user: users.bidder3,
        status: 'documents_verified', // Tier 1 approved, awaiting deposit
        documentUrls: [
          {
            type: 'identity_card',
            url: 'https://example.com/docs/bidder3_id.pdf',
          },
          {
            type: 'financial_proof',
            url: 'https://example.com/docs/bidder3_bank.pdf',
          },
          {
            type: 'business_license',
            url: 'https://example.com/docs/bidder3_license.pdf',
          },
        ],
      },
      {
        user: users.bidder4,
        status: 'pending_document_review', // Documents submitted, awaiting Tier 1 review
        documentUrls: [
          {
            type: 'identity_card',
            url: 'https://example.com/docs/bidder4_id.pdf',
          },
          {
            type: 'financial_proof',
            url: 'https://example.com/docs/bidder4_bank.pdf',
          },
        ],
      },
    ];

    for (const { user, status, documentUrls } of auc001Participants) {
      const participantData = {
        userId: user.id,
        auctionId: auctions['AUC001'].id,
        registeredAt: createDate(-1),
        submittedAt: createDate(-1, 2),
        documents: documentUrls,
      };

      // Two-Tier Approval: Tier 1 - Document Verification
      if (
        status === 'documents_verified' ||
        status === 'deposit_paid' ||
        status === 'confirmed'
      ) {
        participantData.documentsVerifiedAt = createDate(-1, 4);
        participantData.documentsVerifiedBy = users.admin.id;
      }

      // Create payment record for deposit if applicable
      let depositPayment = null;
      if (status === 'deposit_paid' || status === 'confirmed') {
        depositPayment = await prisma.payment.create({
          data: {
            userId: user.id,
            auctionId: auctions['AUC001'].id,
            paymentType: 'deposit',
            amount: auctions['AUC001'].depositAmountRequired,
            currency: 'VND',
            status: 'completed',
            paymentMethod: 'bank_transfer',
            transactionId: `DEP-AUC001-${user.id.substring(0, 8)}`,
            bankCode: 'BIDV',
            paidAt: createDate(-1, 6),
            paymentDetails: {
              auctionCode: 'AUC001',
              participantName: user.fullName,
              verifiedBy: users.admin.id,
            },
          },
        });

        participantData.depositPaidAt = createDate(-1, 6);
        participantData.depositAmount =
          auctions['AUC001'].depositAmountRequired;
        participantData.depositPaymentId = depositPayment.id;
      }

      // Two-Tier Approval: Tier 2 - Final Approval
      if (status === 'confirmed') {
        participantData.confirmedAt = createDate(-1, 8);
        participantData.confirmedBy = users.admin.id;
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
      {
        user: users.bidder,
        status: 'checked_in',
        documentUrls: [
          {
            type: 'identity_card',
            url: 'https://example.com/docs/auc002_bidder1_id.pdf',
          },
          {
            type: 'financial_proof',
            url: 'https://example.com/docs/auc002_bidder1_bank.pdf',
          },
        ],
      },
      {
        user: users.bidder2,
        status: 'checked_in',
        documentUrls: [
          {
            type: 'identity_card',
            url: 'https://example.com/docs/auc002_bidder2_id.pdf',
          },
          {
            type: 'financial_proof',
            url: 'https://example.com/docs/auc002_bidder2_bank.pdf',
          },
        ],
      },
      {
        user: users.bidder3,
        status: 'checked_in',
        documentUrls: [
          {
            type: 'identity_card',
            url: 'https://example.com/docs/auc002_bidder3_id.pdf',
          },
          {
            type: 'financial_proof',
            url: 'https://example.com/docs/auc002_bidder3_bank.pdf',
          },
          {
            type: 'business_license',
            url: 'https://example.com/docs/auc002_bidder3_license.pdf',
          },
        ],
      },
    ];

    const auc002ParticipantIds = [];
    for (const { user, status, documentUrls } of auc002Participants) {
      // Create deposit payment first
      const depositPayment = await prisma.payment.create({
        data: {
          userId: user.id,
          auctionId: auctions['AUC002'].id,
          paymentType: 'deposit',
          amount: auctions['AUC002'].depositAmountRequired,
          currency: 'VND',
          status: 'completed',
          paymentMethod: 'bank_transfer',
          transactionId: `DEP-AUC002-${user.id.substring(0, 8)}`,
          bankCode: 'VIETCOMBANK',
          paidAt: createDate(-6),
          paymentDetails: {
            auctionCode: 'AUC002',
            participantName: user.fullName,
            verifiedBy: users.admin.id,
          },
        },
      });

      const participant = await prisma.auctionParticipant.create({
        data: {
          userId: user.id,
          auctionId: auctions['AUC002'].id,
          registeredAt: createDate(-8),
          submittedAt: createDate(-7),
          documents: documentUrls,
          documentsVerifiedAt: createDate(-7, 2),
          documentsVerifiedBy: users.admin.id,
          depositPaidAt: createDate(-6),
          depositAmount: auctions['AUC002'].depositAmountRequired,
          depositPaymentId: depositPayment.id,
          confirmedAt: createDate(-6, 2),
          confirmedBy: users.admin.id,
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
      {
        user: users.bidder,
        status: 'completed',
        documentUrls: [
          {
            type: 'identity_card',
            url: 'https://example.com/docs/auc003_bidder1_id.pdf',
          },
          {
            type: 'financial_proof',
            url: 'https://example.com/docs/auc003_bidder1_bank.pdf',
          },
        ],
      },
      {
        user: users.bidder2,
        status: 'completed',
        documentUrls: [
          {
            type: 'identity_card',
            url: 'https://example.com/docs/auc003_bidder2_id.pdf',
          },
          {
            type: 'financial_proof',
            url: 'https://example.com/docs/auc003_bidder2_bank.pdf',
          },
        ],
      },
      {
        user: users.bidder4,
        status: 'completed',
        documentUrls: [
          {
            type: 'identity_card',
            url: 'https://example.com/docs/auc003_bidder4_id.pdf',
          },
          {
            type: 'financial_proof',
            url: 'https://example.com/docs/auc003_bidder4_bank.pdf',
          },
        ],
      },
    ];

    const auc003ParticipantIds = [];
    for (const { user, documentUrls } of auc003Participants) {
      // Create deposit payment
      const depositPayment = await prisma.payment.create({
        data: {
          userId: user.id,
          auctionId: auctions['AUC003'].id,
          paymentType: 'deposit',
          amount: auctions['AUC003'].depositAmountRequired,
          currency: 'VND',
          status: 'completed',
          paymentMethod: 'bank_transfer',
          transactionId: `DEP-AUC003-${user.id.substring(0, 8)}`,
          bankCode: 'TECHCOMBANK',
          paidAt: createDate(-15),
          paymentDetails: {
            auctionCode: 'AUC003',
            participantName: user.fullName,
            verifiedBy: users.admin.id,
          },
        },
      });

      const participant = await prisma.auctionParticipant.create({
        data: {
          userId: user.id,
          auctionId: auctions['AUC003'].id,
          registeredAt: createDate(-18),
          submittedAt: createDate(-17),
          documents: documentUrls,
          documentsVerifiedAt: createDate(-16),
          documentsVerifiedBy: users.admin.id,
          depositPaidAt: createDate(-15),
          depositAmount: auctions['AUC003'].depositAmountRequired,
          depositPaymentId: depositPayment.id,
          confirmedAt: createDate(-15, 2),
          confirmedBy: users.admin.id,
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
      // Create winner payment
      const winnerPayment = await prisma.payment.create({
        data: {
          userId: auc003ParticipantIds[2].user.id,
          auctionId: auctions['AUC003'].id,
          paymentType: 'winning_payment',
          amount: winningBid.amount - auctions['AUC003'].depositAmountRequired,
          currency: 'VND',
          status: 'completed',
          paymentMethod: 'bank_transfer',
          transactionId: `WIN-AUC003-${auc003ParticipantIds[2].user.id.substring(
            0,
            8
          )}`,
          bankCode: 'VIETCOMBANK',
          paidAt: createDate(-3),
          paymentDetails: {
            auctionCode: 'AUC003',
            winningBidAmount: winningBid.amount.toString(),
            depositAmount: auctions['AUC003'].depositAmountRequired.toString(),
            remainingAmount: (
              winningBid.amount - auctions['AUC003'].depositAmountRequired
            ).toString(),
            participantName: auc003ParticipantIds[2].user.fullName,
            verifiedBy: users.admin.id,
          },
        },
      });

      const contract = await prisma.contract.create({
        data: {
          auctionId: auctions['AUC003'].id,
          winningBidId: winningBid.id,
          propertyOwnerUserId: users.auctioneer.id,
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
      console.log(
        `    ✓ Created winner payment: ${winnerPayment.amount.toLocaleString(
          'vi-VN'
        )} VND`
      );

      // Create Auction Costs for AUC003
      const auctionCost = await prisma.auctionCost.create({
        data: {
          auctionId: auctions['AUC003'].id,
          advertisingCost: 5000000, // 5M VND
          venueRentalCost: 3000000, // 3M VND
          appraisalCost: 10000000, // 10M VND
          assetViewingCost: 2000000, // 2M VND
          otherCosts: [
            {
              description: 'Photography and documentation',
              amount: 1000000,
              documentUrl: 'https://example.com/docs/photo-receipt.pdf',
            },
            {
              description: 'Legal consultation',
              amount: 5000000,
              documentUrl: 'https://example.com/docs/legal-receipt.pdf',
            },
          ],
          totalCosts: 26000000, // 26M VND total
          documents: [
            'https://example.com/docs/advertising-invoice.pdf',
            'https://example.com/docs/venue-rental-receipt.pdf',
            'https://example.com/docs/appraisal-report.pdf',
          ],
        },
      });
      console.log(`    ✓ Created auction costs for AUC003`);

      // Create Financial Summary for AUC003
      const commissionFee = 55000000; // Calculated based on policy tiers
      const dossierFee = 1000000; // Based on dossier fee policy
      const depositAmount = auctions['AUC003'].depositAmountRequired;
      const finalSalePrice = winningBid.amount;
      const totalAuctionCosts = 26000000;
      const totalFeesToSeller = commissionFee + totalAuctionCosts;
      const netAmountToSeller = finalSalePrice - totalFeesToSeller;

      // Update Auction with Financial Summary directly
      await prisma.auction.update({
        where: { id: auctions['AUC003'].id },
        data: {
          finalSalePrice,
          commissionFee,
          startingPriceSnapshot: auctions['AUC003'].startingPrice,
          dossierFeeSnapshot: dossierFee,
          depositAmountSnapshot: depositAmount,
          totalAuctionCosts,
          totalFeesToPropertyOwner: totalFeesToSeller,
          netAmountToPropertyOwner: netAmountToSeller,
          calculationDetails: {
            breakdown: {
              finalSalePrice: finalSalePrice.toString(),
              commissionFee: commissionFee.toString(),
              dossierFee: dossierFee.toString(),
              totalAuctionCosts: totalAuctionCosts.toString(),
              depositAmount: depositAmount.toString(),
            },
            commissionCalculation: {
              appliedTiers: [
                { from: 0, to: 50000000, rate: 0.05, amount: 2500000 },
                { from: 50000000, to: 100000000, rate: 0.04, amount: 2000000 },
                {
                  from: 100000000,
                  to: 500000000,
                  rate: 0.03,
                  amount: 12000000,
                },
                {
                  from: 500000000,
                  to: 1000000000,
                  rate: 0.02,
                  amount: 10000000,
                },
                {
                  from: 1000000000,
                  to: 5500000000,
                  rate: 0.01,
                  amount: 45000000,
                },
              ],
              totalCommission: 55000000,
            },
            sellerReceives: netAmountToSeller.toString(),
            buyerPays: finalSalePrice.toString(),
          },
          financialCalculatedAt: new Date(),
        },
      });
      console.log(`    ✓ Updated auction AUC003 with financial summary`);
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
        auctionId: auctions['AUC001'].id,
        performedBy: users.admin.id,
        action: 'PARTICIPANT_APPROVED',
        reason: 'Documents verified for bidder (Tier 1)',
      },
      {
        auctionId: auctions['AUC001'].id,
        performedBy: users.admin.id,
        action: 'PARTICIPANT_APPROVED',
        reason: 'Final approval after deposit paid (Tier 2)',
      },
      {
        auctionId: auctions['AUC002'].id,
        performedBy: users.admin.id,
        action: 'AUCTION_CREATED',
        reason: 'Phiên đấu giá xe hơi được tạo',
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
        action: 'AUCTION_CREATED',
        reason: 'Phiên đấu giá đất nền được tạo',
        newStatus: 'scheduled',
      },
      {
        auctionId: auctions['AUC003'].id,
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
      {
        auctionId: auctions['AUC004'].id,
        performedBy: users.admin.id,
        action: 'AUCTION_CREATED',
        reason: 'Phiên đấu giá máy móc được tạo',
        newStatus: 'scheduled',
      },
      {
        auctionId: auctions['AUC004'].id,
        performedBy: users.admin.id,
        action: 'AUCTION_FINALIZED',
        previousStatus: 'live',
        newStatus: 'no_bid',
        reason: 'Không có người đặt giá',
      },
      {
        auctionId: auctions['AUC005'].id,
        performedBy: users.admin.id,
        action: 'AUCTION_CREATED',
        reason: 'Phiên đấu giá villa được tạo',
        newStatus: 'scheduled',
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

    // Add additional test scenarios for registration flows
    console.log('🧪 Creating additional test scenarios...');

    // Scenario 1: Rejected documents (can re-apply)
    const rejectedDocUrls = [
      {
        type: 'identity_card',
        url: 'https://example.com/docs/rejected_id_blurry.pdf',
      },
    ];

    const rejectedParticipant = await prisma.auctionParticipant.create({
      data: {
        userId: users.bidder.id,
        auctionId: auctions['AUC005'].id,
        registeredAt: createDate(6),
        submittedAt: createDate(6, 1),
        documents: rejectedDocUrls,
        documentsRejectedAt: createDate(6, 3),
        documentsRejectedReason:
          'Documents are unclear. Please provide: clear ID photo, complete bank statement',
      },
    });
    console.log(
      `    ✓ Created rejected registration for testing re-submission flow`
    );

    // Scenario 2: Withdrawn registration (can re-apply)
    const withdrawnDocUrls = [
      {
        type: 'identity_card',
        url: 'https://example.com/docs/withdrawn_id.pdf',
      },
      {
        type: 'financial_proof',
        url: 'https://example.com/docs/withdrawn_bank.pdf',
      },
    ];

    const withdrawnParticipant = await prisma.auctionParticipant.create({
      data: {
        userId: users.bidder2.id,
        auctionId: auctions['AUC005'].id,
        registeredAt: createDate(6),
        submittedAt: createDate(6, 1),
        documents: withdrawnDocUrls,
        withdrawnAt: createDate(6, 4),
        withdrawalReason: 'Changed my mind about participating',
      },
    });
    console.log(
      `    ✓ Created withdrawn registration for testing re-registration flow`
    );

    // Scenario 3: Deposit deadline approaching (for testing 24-hour warning)
    const depositDeadlinePayment = await prisma.payment.create({
      data: {
        userId: users.bidder3.id,
        auctionId: auctions['AUC001'].id,
        paymentType: 'deposit',
        amount: auctions['AUC001'].depositAmountRequired,
        currency: 'VND',
        status: 'pending',
        paymentMethod: 'bank_transfer',
        paymentDetails: {
          auctionCode: 'AUC001',
          participantName: users.bidder3.fullName,
          deadlineApproaching: true,
        },
      },
    });
    console.log(`    ✓ Created pending deposit payment for deadline testing`);

    console.log('\n✅ Comprehensive seed completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   👥 Users: ${sampleUsers.length}`);
    console.log(`   ⚙️ System Variables: Seeded`);
    console.log(`   🏛️ Auctions: ${sampleAuctions.length}`);
    console.log('   📸 Images: Added to all auctions');
    console.log('   📎 Attachments: Added to all auctions');
    console.log(
      '   🙋‍♀️ Participants: Multiple per auction with two-tier approval states'
    );
    console.log('   💰 Bids: Active bidding on live auction');
    console.log('   💳 Payments: Deposit and winner payments tracked');
    console.log('   📄 Contracts: 1 signed contract with payment');
    console.log('   💼 Auction Costs: Detailed cost breakdown for AUC003');
    console.log(
      '   📊 Financial Summary: Complete financial analysis for AUC003'
    );
    console.log('   🤖 Auto-bid: 1 active setting');
    console.log(`   📋 Audit logs: ${auditLogs.length} entries`);
    console.log('   🔗 Relations: 1 auction relation');
    console.log(
      '   🧪 Test scenarios: Document rejection, withdrawal, deposit deadline'
    );

    console.log('\n🎯 Test scenarios available:');
    console.log('   • AUC001: Registration open - test two-tier approval flow');
    console.log('     - Bidder 1: Fully approved (can bid)');
    console.log('     - Bidder 2: Deposit paid, awaiting final approval');
    console.log('     - Bidder 3: Documents verified, needs to pay deposit');
    console.log('     - Bidder 4: Documents submitted, awaiting Tier 1 review');
    console.log('   • AUC002: Live auction - test bidding in real-time');
    console.log(
      '   • AUC003: Completed - test post-auction payment & contract flow'
    );
    console.log('   • AUC004: Failed - test no-bid scenario');
    console.log(
      '   • AUC005: Future - test rejection/withdrawal/re-application'
    );

    console.log('\n📧 Email notification test points:');
    console.log(
      '   • Document verification (Tier 1) → User receives payment instructions'
    );
    console.log('   • Deposit payment confirmed → User + admins notified');
    console.log('   • Final approval (Tier 2) → User can now bid');
    console.log('   • Document rejection → User can re-apply');
    console.log('   • Winner payment request → 7-day deadline');
    console.log('   • Winner payment confirmed → Contract ready');

    console.log('\n🔄 Two-Tier Approval Flow:');
    console.log(
      '   1. REGISTERED + PENDING_DOCUMENT_REVIEW → Documents submitted'
    );
    console.log(
      '   2. DOCUMENTS_VERIFIED (Tier 1) → Admin verifies documents ✉️'
    );
    console.log('   3. DEPOSIT_PAID → User pays within 24 hours ✉️');
    console.log('   4. CONFIRMED (Tier 2) → Admin final approval ✉️');
    console.log('   5. READY TO BID → User can place bids');

    console.log('\n⏰ Deadline Testing:');
    console.log('   • Deposit payment: 24 hours from document verification');
    console.log('   • Winner payment: 7 days from auction finalization');
    console.log('   • Auto-cancellation if deadlines missed');
  } catch (error) {
    // Check if error is related to data already existing
    if (
      error.code === 'P2003' ||
      error.message?.includes('foreign key constraint')
    ) {
      console.log('⚠️  Database contains existing data that prevents cleanup');
      console.log('💡 Using existing data - skipping seed');
      console.log(
        '💡 To reseed, run: docker compose down -v && docker compose up --build'
      );
      process.exit(0); // Exit cleanly
    }
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
