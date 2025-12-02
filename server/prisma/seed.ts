/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ArticleType,
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
    prisma.location.deleteMany(),
    prisma.article.deleteMany(),
    prisma.articleRelation.deleteMany(),
  ]);

  console.log('📦 Đang đọc dữ liệu JSON...');
  const data = JSON.parse(fs.readFileSync('./auction-upcoming.json', 'utf8'));

  console.log('⚙️ Chuẩn bị dữ liệu address...');
  const locations: Prisma.LocationCreateInput[] = await JSON.parse(
    fs.readFileSync('./address.json', 'utf8')
  ).map((location) => {
    return {
      id: location.id,
      name: location.label,
      value: Number(location.value),
      sortOrder: location.sortOrder,
      parentId: location.parentId,
    };
  });

  console.log('🚀 Tạo address (createMany)...');
  await prisma.location.createMany({
    data: locations,
  });

  console.log('⚙️ Chuẩn bị dữ liệu auction...');
  const auctionsData = data.data.map((item: any) => ({
    code: item.code,
    name: item.name,
    propertyOwner: {
      name: 'Nguyễn Lê Tuấn Anh',
      email: 'tanh@gm.com',
      phone: '123456789',
      organization: 'UIT',
    },
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
    validCheckInBeforeStartMinutes: item.validCheckInBeforeStartMinutes,
    validCheckInAfterStartMinutes: item.validCheckInAfterStartMinutes,
    depositEndAt: item.depositEndAt ? new Date(item.depositEndAt) : null,
    images: item.auctionImages.map((image: any) => ({
      publicId: null,
      url: 'https://storage.daugiavietnam.com/' + image.url,
    })),
    attachments: item.auctionAttachments.map((attachment: any) => ({
      publicId: null,
      url: 'https://storage.daugiavietnam.com/' + attachment.url,
    })),
    assetWardId: item.assetWardId,
    assetProvinceId: item.assetProvinceId,
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

  await seedArticles();

  console.log('✅ Seed hoàn tất!');
}

function mapCategoryToArticleType(name: string): ArticleType {
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
      throw new Error(`Unknown category name: ${name}`);
  }
}

async function seedArticles() {
  const data = JSON.parse(fs.readFileSync('./article.json', 'utf8'));

  console.log('🚀 Chuẩn bị dữ liệu article...');

  const articlesData: Prisma.ArticleCreateInput[] = data.data.map(
    (item: any) => ({
      title: item.title,
      description: item.description || '',
      author: item.author || 'Unknown',
      content: item.content || '',
      image: {
        publicId: null,
        url: 'https://storage.daugiavietnam.com/' + item.image,
      },
      type: mapCategoryToArticleType(item.category.name), // map sang enum
      createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
    })
  );

  console.log('🚀 Tạo articles (createMany)...');
  await prisma.article.createMany({
    data: articlesData,
    skipDuplicates: true,
  });

  // Lấy lại article vừa tạo để map title -> id
  const articles = await prisma.article.findMany({
    select: { id: true, title: true },
  });
  const articleMap = Object.fromEntries(articles.map((a) => [a.title, a.id]));

  console.log('🔗 Tạo quan hệ related articles (1 chiều)...');
  const relations: { articleId: string; relatedArticleId: string }[] = [];

  for (const item of data.data) {
    const articleId = articleMap[item.title];
    if (!articleId || !item.relatedArticles?.length) continue;

    // Chỉ tạo 1 chiều: articleId -> relatedArticleId
    for (const rel of item.relatedArticles) {
      const relatedId = articleMap[rel.title];
      if (relatedId && relatedId !== articleId) {
        relations.push({ articleId, relatedArticleId: relatedId });
      }
    }
  }

  if (relations.length) {
    // Loại bỏ trùng lặp
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
  }

  console.log('✅ Seed articles hoàn tất!');
}

main()
  .catch((e) => {
    console.error('❌ Seed lỗi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
