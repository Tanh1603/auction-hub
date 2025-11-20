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

  console.log('🧹 Xóa dữ liệu cũ...');
  await prisma.$transaction([
    prisma.auctionRelation.deleteMany(),
    prisma.auctionBid.deleteMany(),
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
    images: item.auctionImages.map((image: any) => ({
      publicId: null,
      url: 'https://storage.daugiavietnam.com/' + image.url,
      sortOrder: image.sortOrder,
    })),
    attachments: item.auctionAttachments.map((attachment: any) => ({
      publicId: null,
      url: 'https://storage.daugiavietnam.com/' + attachment.url,
    })),
  }));

  console.log('🚀 Tạo auctions (createMany)...');
  await prisma.auction.createMany({
    data: auctionsData,
    skipDuplicates: true,
  });

  const auctions = await prisma.auction.findMany({
    select: { id: true, code: true },
  });

  const auctionMap = Object.fromEntries(auctions.map((a) => [a.code, a.id]));

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
