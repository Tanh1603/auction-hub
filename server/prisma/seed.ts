/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ArticleType,
  AssetType,
  AuditAction,
  AuctionStatus,
  PaymentStatus,
  PaymentType,
  PaymentMethod,
  UserRole,
  UserType,
  ContractStatus,
  BidType,
  Prisma,
  PrismaClient,
} from '../../server/generated/index.js';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// ========================================
// HELPER FUNCTIONS
// ========================================

// Helper function to create dates relative to now using offset config
const createDate = (
  daysOffset: number,
  hoursOffset: number = 0,
  minutesOffset: number = 0
): Date => {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  date.setHours(date.getHours() + hoursOffset);
  date.setMinutes(date.getMinutes() + minutesOffset);
  return date;
};

// Parse date offset from JSON config
const parseDateOffset = (
  offset: { days?: number; hours?: number; minutes?: number } | undefined
): Date | null => {
  if (!offset) return null;
  return createDate(offset.days || 0, offset.hours || 0, offset.minutes || 0);
};

// Safe JSON file reader
const readJsonFile = <T>(filename: string): T | null => {
  try {
    const filePath = path.join(__dirname, filename);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    console.log(`  ⚠️ ${filename} not found, skipping...`);
    return null;
  }
};

// Map string to enum helpers
const mapUserType = (type: string): UserType => {
  return type === 'business' ? UserType.business : UserType.individual;
};

const mapUserRole = (role: string): UserRole => {
  switch (role) {
    case 'auctioneer':
      return UserRole.auctioneer;
    case 'admin':
      return UserRole.admin;
    case 'super_admin':
      return UserRole.super_admin;
    default:
      return UserRole.bidder;
  }
};

const mapAssetType = (type: string): AssetType => {
  switch (type) {
    case 'secured_asset':
      return AssetType.secured_asset;
    case 'land_use_rights':
      return AssetType.land_use_rights;
    case 'administrative_violation_asset':
      return AssetType.administrative_violation_asset;
    case 'state_asset':
      return AssetType.state_asset;
    case 'enforcement_asset':
      return AssetType.enforcement_asset;
    default:
      return AssetType.other_asset;
  }
};

const mapAuctionStatus = (status: string): AuctionStatus => {
  switch (status) {
    case 'live':
      return AuctionStatus.live;
    case 'awaiting_result':
      return AuctionStatus.awaiting_result;
    case 'success':
      return AuctionStatus.success;
    case 'failed':
      return AuctionStatus.failed;
    default:
      return AuctionStatus.scheduled;
  }
};

const mapArticleType = (type: string): ArticleType => {
  switch (type) {
    case 'auction_notice':
      return ArticleType.auction_notice;
    case 'auction_report':
      return ArticleType.auction_report;
    case 'legal_document':
      return ArticleType.legal_document;
    default:
      return ArticleType.news;
  }
};

const mapCategoryToArticleType = (name: string): ArticleType => {
  switch (name) {
    case 'Tin tức':
      return ArticleType.news;
    case 'Thông báo đấu giá':
      return ArticleType.auction_notice;
    case 'Điểm tin đấu giá':
      return ArticleType.auction_report;
    case 'Văn bản pháp luật':
      return ArticleType.legal_document;
    default:
      return ArticleType.news;
  }
};

const mapAuditAction = (action: string): AuditAction => {
  switch (action) {
    case 'STATUS_OVERRIDE':
      return AuditAction.STATUS_OVERRIDE;
    case 'BID_DENIED':
      return AuditAction.BID_DENIED;
    case 'PARTICIPANT_APPROVED':
      return AuditAction.PARTICIPANT_APPROVED;
    case 'PARTICIPANT_REJECTED':
      return AuditAction.PARTICIPANT_REJECTED;
    case 'AUCTION_FINALIZED':
      return AuditAction.AUCTION_FINALIZED;
    case 'CONTRACT_CREATED':
      return AuditAction.CONTRACT_CREATED;
    case 'AUCTION_UPDATED':
      return AuditAction.AUCTION_UPDATED;
    case 'AUCTION_CANCELLED':
      return AuditAction.AUCTION_CANCELLED;
    default:
      return AuditAction.AUCTION_CREATED;
  }
};

// ========================================
// MAIN SEED FUNCTION
// ========================================

async function clearDatabase() {
  const tables: { tablename: string }[] = await prisma.$queryRawUnsafe(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname='public' AND tablename != '_prisma_migrations';
  `);

  for (const table of tables) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${table.tablename}";`);
  }

  console.log('🧹 All tables cleared');
}



async function main() {
  await prisma.$connect();
  await clearDatabase();
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
    return;
  }

  console.log('🧹 Database is empty, proceeding with seed...');

  // Store references for relations
  const users: Record<string, any> = {};
  const auctionMap: Record<string, string> = {};
  const participantMap: Record<string, { id: string; user: any }[]> = {};

  // ========================================
  // 1. SEED SYSTEM VARIABLES
  // ========================================
  await seedSystemVariables();

  // ========================================
  // 2. SEED LOCATIONS
  // ========================================
  await seedLocations();

  // ========================================
  // 3. SEED USERS
  // ========================================
  await seedUsers(users);

  // ========================================
  // 4. SEED ARTICLES
  // ========================================
  await seedArticles();

  // ========================================
  // 5. SEED AUCTIONS
  // ========================================
  await seedAuctions(users, auctionMap);

  // ========================================
  // 6. SEED TEST SCENARIOS (Participants, Bids, Payments, etc.)
  // ========================================
  await seedTestScenarios(users, auctionMap, participantMap);

  console.log('\n✅ Seed completed successfully!');
  printSummary();
}

// ========================================
// SEED FUNCTIONS
// ========================================

async function seedSystemVariables() {
  console.log('\n⚙️  Seeding system variables...');

  const data = readJsonFile<{ data: any[] }>('system-variables.json');
  if (!data) return;

  for (const variable of data.data) {
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
  console.log(`  ✓ Created ${data.data.length} system variables`);
}

async function seedLocations() {
  console.log('\n📍 Seeding location data...');

  const data = readJsonFile<any[]>('address.json');
  if (!data) {
    console.log('  ⚠️ No location data available');
    return;
  }

  const locations: Prisma.LocationCreateManyInput[] = data.map(
    (location: any) => ({
      id: location.id,
      name: location.label,
      value: Number(location.value),
      sortOrder: location.sortOrder,
      parentId: location.parentId,
    })
  );

  await prisma.location.createMany({ data: locations, skipDuplicates: true });
  console.log(`  ✓ Created ${locations.length} locations`);
}

async function seedUsers(users: Record<string, any>) {
  console.log('\n👥 Creating users...');

  const data = readJsonFile<{ data: any[] }>('users.json');
  if (!data) return;

  for (const userData of data.data) {
    const { roleKey, ...userFields } = userData;
    const user = await prisma.user.create({
      data: {
        ...userFields,
        userType: mapUserType(userFields.userType),
        role: mapUserRole(userFields.role),
        updatedAt: new Date(),
      },
    });
    users[roleKey] = user;
    console.log(
      `  ✓ Created ${roleKey}: ${userData.fullName} (${userData.email})`
    );
  }
}

async function seedArticles() {
  console.log('\n📰 Seeding articles...');

  // Try to read from article.json first (main data source)
  const mainData = readJsonFile<{ data: any[] }>('article.json');
  if (mainData) {
    const articlesData = mainData.data.map((item: any) => ({
      title: item.title,
      description: item.description || '',
      author: item.author || 'Unknown',
      content: item.content || '',
      image: item.image
        ? {
            publicId: null,
            url: 'https://storage.daugiavietnam.com/' + item.image,
          }
        : Prisma.DbNull,
      type: mapCategoryToArticleType(item.category?.name || 'Tin tức'),
      createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
    }));

    await prisma.article.createMany({
      data: articlesData as any,
      skipDuplicates: true,
    });
    console.log(
      `  ✓ Created ${articlesData.length} articles from article.json`
    );

    // Create article relations
    const articles = await prisma.article.findMany({
      select: { id: true, title: true },
    });
    const articleMap = Object.fromEntries(articles.map((a) => [a.title, a.id]));
    const relations: { articleId: string; relatedArticleId: string }[] = [];

    for (const item of mainData.data) {
      const articleId = articleMap[item.title];
      if (!articleId || !item.relatedArticles?.length) continue;
      for (const rel of item.relatedArticles) {
        const relatedId = articleMap[rel.title];
        if (relatedId && relatedId !== articleId) {
          relations.push({ articleId, relatedArticleId: relatedId });
        }
      }
    }

    if (relations.length) {
      const uniqueRelations = Array.from(
        new Set(relations.map((r) => `${r.articleId}_${r.relatedArticleId}`))
      ).map((s) => {
        const [articleId, relatedArticleId] = s.split('_');
        return { articleId, relatedArticleId };
      });
      await prisma.articleRelation.createMany({
        data: uniqueRelations,
        skipDuplicates: true,
      });
      console.log(`  ✓ Created ${uniqueRelations.length} article relations`);
    }
    return;
  }

  // Fallback to sample-articles.json
  const sampleData = readJsonFile<{ data: any[] }>('sample-articles.json');
  if (sampleData) {
    for (const article of sampleData.data) {
      await prisma.article.create({
        data: {
          ...article,
          type: mapArticleType(article.type),
        },
      });
      console.log(`  ✓ Created article: ${article.title.substring(0, 50)}...`);
    }
    console.log(`  ✓ Created ${sampleData.data.length} sample articles`);
  }
}

async function seedAuctions(
  users: Record<string, any>,
  auctionMap: Record<string, string>
) {
  console.log('\n🏛️ Seeding auctions...');

  let hasSeededProductionData = false;

  // 1. Seed Upcoming Auctions
  const upcomingData = readJsonFile<{ data: any[] }>('auction-upcoming.json');
  if (upcomingData) {
    const auctionsData = upcomingData.data.map((item: any) => ({
      code: item.code,
      name: item.name,
      propertyOwner: {
        name: users.auctioneer?.fullName || 'Nguyễn Lê Tuấn Anh',
        email: users.auctioneer?.email || 'tanh@gm.com',
        phone: users.auctioneer?.phoneNumber || '123456789',
        organization: 'UIT',
      },
      assetType: item.assetType?.value as AssetType,
      status: item.status as AuctionStatus,
      saleStartAt: new Date(item.saleStartAt),
      saleEndAt: new Date(item.saleEndAt),
      auctionStartAt: new Date(item.auctionStartAt),
      auctionEndAt: new Date(item.auctionEndAt),
      viewTime: item.viewTime,
      saleFee: new Prisma.Decimal(item.saleFee),
      depositAmountRequired: new Prisma.Decimal(item.depositAmountRequired),
      startingPrice: new Prisma.Decimal(item.startingPrice),
      bidIncrement: new Prisma.Decimal(item.bidIncrement),
      assetDescription: item.assetDescription,
      assetAddress: item.assetAddress,
      validCheckInBeforeStartMinutes: item.validCheckInBeforeStartMinutes,
      validCheckInAfterStartMinutes: item.validCheckInAfterStartMinutes,
      depositEndAt: item.depositEndAt ? new Date(item.depositEndAt) : null,
      images:
        item.auctionImages?.map((image: any) => ({
          publicId: null,
          url: 'https://storage.daugiavietnam.com/' + image.url,
        })) || [],
      attachments:
        item.auctionAttachments?.map((attachment: any) => ({
          publicId: null,
          url: 'https://storage.daugiavietnam.com/' + attachment.url,
        })) || [],
      assetWardId: item.assetWardId,
      assetProvinceId: item.assetProvinceId,
    }));

    await prisma.auction.createMany({
      data: auctionsData as any,
      skipDuplicates: true,
    });
    console.log(
      `  ✓ Created ${auctionsData.length} auctions from auction-upcoming.json`
    );
    hasSeededProductionData = true;
  }

  // 2. Seed Completed Auctions
  const completedData = readJsonFile<{ data: any[] }>(
    'auction-commpleted.json'
  );
  if (completedData) {
    const auctionsData = completedData.data.map((item: any) => ({
      code: item.code,
      name: item.name,
      propertyOwner: {
        name: users.auctioneer?.fullName || 'Nguyễn Lê Tuấn Anh',
        email: users.auctioneer?.email || 'tanh@gm.com',
        phone: users.auctioneer?.phoneNumber || '123456789',
        organization: 'UIT',
      },
      assetType: item.assetType?.value as AssetType,
      status: item.status as AuctionStatus,
      saleStartAt: new Date(item.saleStartAt),
      saleEndAt: new Date(item.saleEndAt),
      auctionStartAt: new Date(item.auctionStartAt),
      auctionEndAt: new Date(item.auctionEndAt),
      viewTime: item.viewTime,
      saleFee: new Prisma.Decimal(item.saleFee),
      depositAmountRequired: new Prisma.Decimal(item.depositAmountRequired),
      startingPrice: new Prisma.Decimal(item.startingPrice),
      bidIncrement: new Prisma.Decimal(item.bidIncrement),
      assetDescription: item.assetDescription,
      assetAddress: item.assetAddress,
      validCheckInBeforeStartMinutes: item.validCheckInBeforeStartMinutes,
      validCheckInAfterStartMinutes: item.validCheckInAfterStartMinutes,
      depositEndAt: item.depositEndAt ? new Date(item.depositEndAt) : null,
      images:
        item.auctionImages?.map((image: any) => ({
          publicId: null,
          url: 'https://storage.daugiavietnam.com/' + image.url,
        })) || [],
      attachments:
        item.auctionAttachments?.map((attachment: any) => ({
          publicId: null,
          url: 'https://storage.daugiavietnam.com/' + attachment.url,
        })) || [],
      assetWardId: item.assetWardId,
      assetProvinceId: item.assetProvinceId,
    }));

    await prisma.auction.createMany({
      data: auctionsData as any,
      skipDuplicates: true,
    });
    console.log(
      `  ✓ Created ${auctionsData.length} auctions from auction-commpleted.json`
    );
    hasSeededProductionData = true;
  }

  if (hasSeededProductionData) {
    // Build auction map from ALL seeded auctions
    const auctions = await prisma.auction.findMany({
      select: { id: true, code: true },
    });
    for (const a of auctions) {
      auctionMap[a.code] = a.id;
    }

    // Create auction relations for both datasets
    const allRelations: { auctionId: string; relatedAuctionId: string }[] = [];

    // Process relations from upcoming data
    if (upcomingData) {
      for (const item of upcomingData.data) {
        const auctionId = auctionMap[item.code];
        if (!item.relatedAuctions?.length || !auctionId) continue;
        for (const rel of item.relatedAuctions) {
          const relatedId = auctionMap[rel.code];
          if (relatedId) {
            allRelations.push({ auctionId, relatedAuctionId: relatedId });
          }
        }
      }
    }

    // Process relations from completed data
    if (completedData) {
      for (const item of completedData.data) {
        const auctionId = auctionMap[item.code];
        if (!item.relatedAuctions?.length || !auctionId) continue;
        for (const rel of item.relatedAuctions) {
          const relatedId = auctionMap[rel.code];
          if (relatedId) {
            allRelations.push({ auctionId, relatedAuctionId: relatedId });
          }
        }
      }
    }

    if (allRelations.length) {
      // De-duplicate relations
      const uniqueRelations = Array.from(
        new Set(allRelations.map(JSON.stringify))
      ).map(JSON.parse);

      await prisma.auctionRelation.createMany({
        data: uniqueRelations,
        skipDuplicates: true,
      });
      console.log(`  ✓ Created ${uniqueRelations.length} auction relations`);
    }
    return;
  }

  // Fallback to sample-auctions.json if NO production data was found
  const sampleData = readJsonFile<{ data: any[] }>('sample-auctions.json');
  if (sampleData) {
    console.log(
      '  ⚠️ No production data found (upcoming/completed), falling back to sample auctions.'
    );
    for (const auctionData of sampleData.data) {
      const { dateOffsets, images, attachments, ...fields } = auctionData;

      const auction = await prisma.auction.create({
        data: {
          ...fields,
          assetType: mapAssetType(fields.assetType),
          status: mapAuctionStatus(fields.status),
          saleStartAt: parseDateOffset(dateOffsets.saleStartAt)!,
          saleEndAt: parseDateOffset(dateOffsets.saleEndAt)!,
          depositEndAt: parseDateOffset(dateOffsets.depositEndAt),
          auctionStartAt: parseDateOffset(dateOffsets.auctionStartAt)!,
          auctionEndAt: parseDateOffset(dateOffsets.auctionEndAt)!,
          saleFee: new Prisma.Decimal(fields.saleFee),
          depositAmountRequired: new Prisma.Decimal(
            fields.depositAmountRequired
          ),
          startingPrice: new Prisma.Decimal(fields.startingPrice),
          bidIncrement: new Prisma.Decimal(fields.bidIncrement),
          propertyOwner: {
            name: users.auctioneer?.fullName || 'Property Owner',
            email: users.auctioneer?.email || 'owner@example.com',
            phone: users.auctioneer?.phoneNumber || '0123456789',
            organization: 'UIT',
          },
          images: images?.map((img: any) => ({ ...img, publicId: null })) || [],
          attachments:
            attachments?.map((att: any) => ({ ...att, publicId: null })) || [],
        },
      });
      auctionMap[auctionData.code] = auction.id;
      console.log(
        `  ✓ Created auction: ${auctionData.code} - ${auctionData.name}`
      );
    }
  }
}

async function seedTestScenarios(
  users: Record<string, any>,
  auctionMap: Record<string, string>,
  participantMap: Record<string, { id: string; user: any }[]>
) {
  const data = readJsonFile<{
    participants: Record<string, any[]>;
    bids: Record<string, any[]>;
    autoBidSettings: any[];
    auctionCosts: Record<string, any>;
    contracts: Record<string, any>;
    auditLogs: any[];
  }>('test-scenarios.json');

  if (!data) return;

  // ========================================
  // SEED PARTICIPANTS
  // ========================================
  console.log('\n🙋‍♀️ Creating participants...');
  for (const [auctionCode, participants] of Object.entries(data.participants)) {
    const auctionId = auctionMap[auctionCode];
    if (!auctionId) continue;

    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
    });
    if (!auction) continue;

    participantMap[auctionCode] = [];

    for (const participantConfig of participants) {
      const user = users[participantConfig.userRoleKey];
      if (!user) continue;

      const {
        dateOffsets,
        documents,
        createDepositPayment,
        status,
        userRoleKey,
      } = participantConfig;

      // Create deposit payment if needed
      let depositPaymentId: string | undefined;
      if (createDepositPayment) {
        const payment = await prisma.payment.create({
          data: {
            userId: user.id,
            auctionId,
            paymentType: PaymentType.deposit,
            amount: auction.depositAmountRequired,
            currency: 'VND',
            status: PaymentStatus.completed,
            paymentMethod: PaymentMethod.bank_transfer,
            transactionId: `DEP-${auctionCode}-${user.id.substring(0, 8)}`,
            bankCode: 'BIDV',
            paidAt: parseDateOffset(dateOffsets.depositPaidAt),
          },
        });
        depositPaymentId = payment.id;
      }

      // Create participant
      const participant = await prisma.auctionParticipant.create({
        data: {
          userId: user.id,
          auctionId,
          registeredAt: parseDateOffset(dateOffsets.registeredAt),
          submittedAt: parseDateOffset(dateOffsets.submittedAt),
          documents,
          documentsVerifiedAt: parseDateOffset(dateOffsets.documentsVerifiedAt),
          documentsVerifiedBy: dateOffsets.documentsVerifiedAt
            ? users.admin?.id
            : undefined,
          depositPaidAt: parseDateOffset(dateOffsets.depositPaidAt),
          depositAmount: createDepositPayment
            ? auction.depositAmountRequired
            : undefined,
          depositPaymentId,
          confirmedAt: parseDateOffset(dateOffsets.confirmedAt),
          confirmedBy: dateOffsets.confirmedAt ? users.admin?.id : undefined,
          checkedInAt: parseDateOffset(dateOffsets.checkedInAt),
        },
      });

      participantMap[auctionCode].push({ id: participant.id, user });
    }
    console.log(
      `  ✓ Added ${participants.length} participants to ${auctionCode}`
    );
  }

  // ========================================
  // SEED BIDS
  // ========================================
  console.log('\n💰 Creating bids...');
  for (const [auctionCode, bids] of Object.entries(data.bids)) {
    const auctionId = auctionMap[auctionCode];
    const participants = participantMap[auctionCode];
    if (!auctionId || !participants?.length) continue;

    for (let i = 0; i < bids.length; i++) {
      const { participantIndex, amount, minutesOffset } = bids[i];
      const participant = participants[participantIndex];
      if (!participant) continue;

      await prisma.auctionBid.create({
        data: {
          auctionId,
          participantId: participant.id,
          amount: new Prisma.Decimal(amount),
          bidAt: createDate(0, 0, minutesOffset),
          bidType: BidType.manual,
          isWinningBid: i === bids.length - 1,
        },
      });
    }
    console.log(`  ✓ Created ${bids.length} bids for ${auctionCode}`);
  }

  // ========================================
  // SEED AUTO-BID SETTINGS
  // ========================================
  console.log('\n🤖 Creating auto-bid settings...');
  for (const setting of data.autoBidSettings) {
    const participants = participantMap[setting.auctionCode];
    const participant = participants?.[setting.participantIndex];
    if (!participant) continue;

    await prisma.autoBidSetting.create({
      data: {
        participantId: participant.id,
        maxAmount: new Prisma.Decimal(setting.maxAmount),
        incrementAmount: new Prisma.Decimal(setting.incrementAmount),
        isActive: setting.isActive,
      },
    });
    console.log(`  ✓ Created auto-bid setting for ${setting.auctionCode}`);
  }

  // ========================================
  // SEED AUCTION COSTS
  // ========================================
  console.log('\n💼 Creating auction costs...');
  for (const [auctionCode, costs] of Object.entries(data.auctionCosts)) {
    const auctionId = auctionMap[auctionCode];
    if (!auctionId) continue;

    await prisma.auctionCost.create({
      data: {
        auctionId,
        advertisingCost: new Prisma.Decimal(costs.advertisingCost),
        venueRentalCost: new Prisma.Decimal(costs.venueRentalCost),
        appraisalCost: new Prisma.Decimal(costs.appraisalCost),
        assetViewingCost: new Prisma.Decimal(costs.assetViewingCost),
        otherCosts: costs.otherCosts,
        totalCosts: new Prisma.Decimal(costs.totalCosts),
        documents: costs.documents,
      },
    });
    console.log(`  ✓ Created costs for ${auctionCode}`);
  }

  // ========================================
  // SEED CONTRACTS (for completed auctions)
  // ========================================
  console.log('\n📄 Creating contracts...');
  for (const [auctionCode, contractConfig] of Object.entries(data.contracts)) {
    const auctionId = auctionMap[auctionCode];
    const participants = participantMap[auctionCode];
    const winnerParticipant =
      participants?.[contractConfig.winnerParticipantIndex];
    if (!auctionId || !winnerParticipant) continue;

    // Get winning bid
    const winningBid = await prisma.auctionBid.findFirst({
      where: { auctionId, isWinningBid: true },
    });
    if (!winningBid) continue;

    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
    });
    if (!auction) continue;

    // Create winner payment
    const remainingAmount =
      Number(winningBid.amount) - Number(auction.depositAmountRequired);
    await prisma.payment.create({
      data: {
        userId: winnerParticipant.user.id,
        auctionId,
        paymentType: PaymentType.winning_payment,
        amount: new Prisma.Decimal(remainingAmount),
        currency: 'VND',
        status: PaymentStatus.completed,
        paymentMethod: PaymentMethod.bank_transfer,
        transactionId: `WIN-${auctionCode}-${winnerParticipant.user.id.substring(
          0,
          8
        )}`,
        bankCode: 'VIETCOMBANK',
        paidAt: parseDateOffset(contractConfig.signedAtOffset),
      },
    });

    // Create contract
    await prisma.contract.create({
      data: {
        auctionId,
        winningBidId: winningBid.id,
        propertyOwnerUserId: users.auctioneer?.id,
        buyerUserId: winnerParticipant.user.id,
        createdBy: users.admin?.id,
        price: winningBid.amount,
        status: ContractStatus.signed,
        signedAt: parseDateOffset(contractConfig.signedAtOffset),
      },
    });
    console.log(`  ✓ Created contract for ${auctionCode}`);

    // Update auction with financial summary
    const finalSalePrice = Number(winningBid.amount);
    const commissionFee = contractConfig.commissionFee;
    const totalAuctionCosts = data.auctionCosts[auctionCode]?.totalCosts || 0;
    const totalFeesToSeller = commissionFee + totalAuctionCosts;
    const netAmountToSeller = finalSalePrice - totalFeesToSeller;

    await prisma.auction.update({
      where: { id: auctionId },
      data: {
        finalSalePrice: new Prisma.Decimal(finalSalePrice),
        commissionFee: new Prisma.Decimal(commissionFee),
        startingPriceSnapshot: auction.startingPrice,
        dossierFeeSnapshot: new Prisma.Decimal(contractConfig.dossierFee),
        depositAmountSnapshot: auction.depositAmountRequired,
        totalAuctionCosts: new Prisma.Decimal(totalAuctionCosts),
        totalFeesToPropertyOwner: new Prisma.Decimal(totalFeesToSeller),
        netAmountToPropertyOwner: new Prisma.Decimal(netAmountToSeller),
        financialCalculatedAt: new Date(),
      },
    });
    console.log(`  ✓ Updated ${auctionCode} with financial summary`);
  }

  // ========================================
  // SEED AUDIT LOGS
  // ========================================
  console.log('\n📋 Creating audit logs...');
  const auditLogs: Prisma.AuctionAuditLogCreateManyInput[] = [];
  for (const log of data.auditLogs) {
    const auctionId = auctionMap[log.auctionCode];
    if (!auctionId || !users.admin) continue;

    auditLogs.push({
      auctionId,
      performedBy: users.admin.id,
      action: mapAuditAction(log.action),
      previousStatus: log.previousStatus
        ? mapAuctionStatus(log.previousStatus)
        : undefined,
      newStatus: log.newStatus ? mapAuctionStatus(log.newStatus) : undefined,
      reason: log.reason,
    });
  }

  if (auditLogs.length) {
    await prisma.auctionAuditLog.createMany({
      data: auditLogs,
      skipDuplicates: true,
    });
    console.log(`  ✓ Created ${auditLogs.length} audit log entries`);
  }
}

function printSummary() {
  console.log('\n📊 Summary:');
  console.log('   ⚙️ System Variables: from system-variables.json');
  console.log('   📍 Locations: from address.json');
  console.log('   👥 Users: from users.json');
  console.log('   📰 Articles: from article.json or sample-articles.json');
  console.log(
    '   🏛️ Auctions: from auction-upcoming.json or sample-auctions.json'
  );
  console.log('   🙋‍♀️ Participants: from test-scenarios.json');
  console.log('   💰 Bids: from test-scenarios.json');
  console.log('   🤖 Auto-bid: from test-scenarios.json');
  console.log('   💼 Auction Costs: from test-scenarios.json');
  console.log('   📄 Contracts: from test-scenarios.json');
  console.log('   📋 Audit Logs: from test-scenarios.json');

  console.log('\n🎯 Test scenarios available:');
  console.log('   • AUC001: Registration open - test two-tier approval flow');
  console.log('   • AUC002: Live auction - test bidding in real-time');
  console.log(
    '   • AUC003: Completed - test post-auction payment & contract flow'
  );
  console.log('   • AUC004: Failed - test no-bid scenario');
  console.log('   • AUC005: Future - test upcoming auction');
}

// ========================================
// RUN SEED
// ========================================

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
