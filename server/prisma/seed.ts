// /* eslint-disable @typescript-eslint/no-explicit-any */
// import {
//   AuctionStatus,
//   Prisma,
//   PrismaClient,
// } from '../../server/generated/index.js';
// import fs from 'fs';

// const prisma = new PrismaClient();

// async function main() {
//   await prisma.$connect();
//   const data = await JSON.parse(
//     fs.readFileSync('./auction-upcomming.json', 'utf8')
//   );

//   const user = await prisma.user.upsert({
//     where: {
//       email: 'tanh@gm.com',
//     },
//     update: {},
//     create: {
//       fullName: 'Nguyễn Lê Tuấn Anh',
//       email: 'tanh@gm.com',
//       userType: 'individual',
//       updatedAt: new Date(),
//     },
//   });

//   for (const item of data.data) {
//     await prisma.$transaction(
//       async (db) => {
//         await db.auction.create({
//           data: {
//             code: item.code,
//             name: item.name,
//             propertyOwner: user.id,
//             assetType: item.assetType.value,
//             status: item.status as AuctionStatus,
//             saleStartAt: new Date(item.saleStartAt),
//             saleEndAt: new Date(item.saleEndAt),
//             auctionStartAt: new Date(item.auctionStartAt),
//             auctionEndAt: new Date(item.auctionEndAt),
//             viewTime: item.viewTime,
//             saleFee: new Prisma.Decimal(item.saleFee),
//             depositAmountRequired: new Prisma.Decimal(
//               item.depositAmountRequired
//             ),
//             startingPrice: new Prisma.Decimal(item.startingPrice),
//             bidIncrement: new Prisma.Decimal(item.bidIncrement),
//             assetDescription: item.assetDescription,
//             assetAddress: item.assetAddress,
//             isActive: true,
//             hasMaxBidSteps: false,
//             maxBidSteps: 0,
//             validCheckInBeforeStartMinutes: item.validCheckInBeforeStartMinutes,
//             validCheckInAfterStartMinutes: item.validCheckInAfterStartMinutes,
//             depositEndAt: item.depositEndAt,
//             images: {
//               create: await Promise.all<[]>(
//                 item.auctionImages?.map((img: any, i: number) => ({
//                   url: img.url,
//                   sortOrder: i,
//                 })) || []
//               ),
//             },
//             attachments: {
//               create: await Promise.all<[]>(
//                 item.auctionAttachments?.map((a: any) => ({
//                   url: a.url,
//                   type: a.type ?? 'document',
//                 })) || []
//               ),
//             },
//           },
//         });
//       },
//       { timeout: 300000 }
//     );
//   }

//   for (const item of data.data) {
//     if (!item.relatedAuctions?.length) continue;

//     const auction = await prisma.auction.findUnique({
//       where: { code: item.code },
//     });

//     if (!auction) continue;

//     for (const rel of item.relatedAuctions) {
//       if (!rel.code) continue;

//       const related = await prisma.auction.findUnique({
//         where: { code: rel.code },
//       });

//       if (!related) {
//         console.warn(`⚠️ Related auction ${rel.code} không tồn tại.`);
//         continue;
//       }

//       await prisma.auctionRelation.create({
//         data: {
//           auctionId: auction.id,
//           relatedAuctionId: related.id,
//         },
//       });
//     }
//   }
// }

// main()
//   .catch((e) => {
//     console.error('❌ Seed lỗi:', e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });

/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  AuctionStatus,
  Prisma,
  PrismaClient,
} from '../../server/generated/index.js';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  await prisma.$connect();

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
  console.log('🧹 Xóa dữ liệu cũ...');
  await prisma.$transaction([
    prisma.auctionRelation.deleteMany(),
    prisma.auctionBid.deleteMany(),
    prisma.auctionImage.deleteMany(),
    prisma.auctionAttachment.deleteMany(),
    prisma.auction.deleteMany(),
  ]);

  console.log('📦 Đang đọc dữ liệu JSON...');
  const data = JSON.parse(fs.readFileSync('./auction-upcoming.json', 'utf8'));

  console.log('👤 Đảm bảo user tồn tại...');
  const user = await prisma.user.upsert({
    where: { email: 'tanh@gm.com' },
    update: {},
    create: {
      fullName: 'Nguyễn Lê Tuấn Anh',
      email: 'tanh@gm.com',
      userType: 'individual',
      updatedAt: new Date(),
    },
  });

  console.log('⚙️ Chuẩn bị dữ liệu auction...');
  const auctionsData = data.data.map((item: any) => ({
    code: item.code,
    name: item.name,
    propertyOwner: user.id,
    assetType: item.assetType.value,
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
    isActive: true,
    hasMaxBidSteps: false,
    maxBidSteps: 0,
    validCheckInBeforeStartMinutes: item.validCheckInBeforeStartMinutes,
    validCheckInAfterStartMinutes: item.validCheckInAfterStartMinutes,
    depositEndAt: item.depositEndAt ? new Date(item.depositEndAt) : null,
  }));

  console.log('🚀 Tạo auctions (createMany)...');
  await prisma.auction.createMany({
    data: auctionsData,
    skipDuplicates: true,
  });

  console.log('🖼️ Tạo images và attachments...');
  const auctions = await prisma.auction.findMany({
    select: { id: true, code: true },
  });

  const auctionMap = Object.fromEntries(auctions.map((a) => [a.code, a.id]));

  const imagesData = data.data.flatMap((item: any) =>
    (item.auctionImages ?? []).map((img: any, i: number) => ({
      auctionId: auctionMap[item.code],
      url: img.url,
      sortOrder: i,
    }))
  );

  const attachmentsData = data.data.flatMap((item: any) =>
    (item.auctionAttachments ?? []).map((a: any) => ({
      auctionId: auctionMap[item.code],
      url: a.url,
      type: a.type ?? 'document',
    }))
  );

  if (imagesData.length)
    await prisma.auctionImage.createMany({ data: imagesData });
  if (attachmentsData.length)
    await prisma.auctionAttachment.createMany({ data: attachmentsData });

  console.log('🔗 Tạo quan hệ related auctions...');
  const relations: { auctionId: string; relatedAuctionId: string }[] = [];

  for (const item of data.data) {
    const auctionId = auctionMap[item.code];
    if (!item.relatedAuctions?.length || !auctionId) continue;

    for (const rel of item.relatedAuctions) {
      const relatedId = auctionMap[rel.code];
      if (relatedId) {
        relations.push({ auctionId, relatedAuctionId: relatedId });
      } else {
        console.warn(`⚠️ Related auction ${rel.code} không tồn tại.`);
      }
    }
  }

  if (relations.length)
    await prisma.auctionRelation.createMany({ data: relations });

  console.log('✅ Seed hoàn tất!');
}

main()
  .catch((e) => {
    console.error('❌ Seed lỗi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
