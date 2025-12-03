import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as path from 'path';
import type { Auction, User, AuctionBid, ContractStatus } from '../../generated';

interface ContractWithRelations {
  id: string;
  auctionId: string;
  winningBidId: string;
  sellerUserId: string;
  buyerUserId: string;
  createdBy: string;
  price: number | string;
  status: ContractStatus;
  signedAt: Date | null;
  cancelledAt: Date | null;
  docUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  auction: Auction;
  seller: User;
  buyer: User;
  creator: User;
  winningBid: AuctionBid;
}

@Injectable()
export class PdfGeneratorService {
  generateContractPdf(contract: ContractWithRelations): PDFDocument {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const projectRoot = path.join(__dirname, '..', '..');
    const fontPath = path.join(projectRoot, 'server', 'src', 'assets', 'font', 'Inter', 'static');

    let normalFont = 'Helvetica';
    let boldFont = 'Helvetica-Bold';
    let semiBoldFont = 'Helvetica-Bold';

    try {
      doc.registerFont('Inter-Regular', path.join(fontPath, 'Inter_18pt-Regular.ttf'));
      doc.registerFont('Inter-Bold', path.join(fontPath, 'Inter_18pt-Bold.ttf'));
      doc.registerFont('Inter-SemiBold', path.join(fontPath, 'Inter_18pt-SemiBold.ttf'));
      normalFont = 'Inter-Regular';
      boldFont = 'Inter-Bold';
      semiBoldFont = 'Inter-SemiBold';
    } catch (error) {
      console.warn('Inter fonts not found — using Helvetica fallback. Error: ', error);
    }

    const drawSeparator = (yOffset = 10) => {
      doc.moveDown(0.3);
      const currentY = doc.y + yOffset;
      doc
        .moveTo(50, currentY)
        .lineTo(545, currentY)
        .lineWidth(0.5)
        .strokeColor('#aaaaaa')
        .stroke();
      doc.moveDown(1);
    };

    doc
      .font(boldFont)
      .fontSize(22)
      .text('HỢP ĐỒNG ĐẤU GIÁ TÀI SẢN', { align: 'center' });

    doc
      .fontSize(12)
      .font(normalFont)
      .text(`Mã hợp đồng: ${contract.id}`, { align: 'center' })
      .text(
        `Ngày tạo: ${contract.createdAt.toLocaleDateString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })}`,
        { align: 'center' },
      )
      .moveDown(1.5);

    doc.fontSize(14).font(semiBoldFont).text('THÔNG TIN PHIÊN ĐẤU GIÁ');
    drawSeparator();

    doc
      .fontSize(11)
      .font(normalFont)
      .text(`Mã phiên đấu giá: ${contract.auction.code}`)
      .text(`Tên tài sản: ${contract.auction.name}`)
      .text(`Loại tài sản: ${contract.auction.assetType}`)
      .text(`Địa chỉ tài sản: ${contract.auction.assetAddress}`)
      .moveDown(1.5);

    doc.fontSize(14).font(semiBoldFont).text('THÔNG TIN CÁC BÊN THAM GIA');
    drawSeparator();

    const startY = doc.y;
    const leftX = 50;
    const rightX = 310;

    doc.fontSize(12).font(semiBoldFont).text('BÊN BÁN (CHỦ SỞ HỮU):', leftX, startY);
    doc
      .fontSize(11)
      .font(normalFont)
      .text(`Họ tên: ${contract.seller.fullName}`, leftX, doc.y)
      .text(`Email: ${contract.seller.email}`, leftX, doc.y)
      .text(`SĐT: ${contract.seller.phoneNumber || 'Không có'}`, leftX, doc.y);

    doc.fontSize(12).font(semiBoldFont).text('BÊN MUA (NGƯỜI TRÚNG THẦU):', rightX, startY);
    doc
      .fontSize(11)
      .font(normalFont)
      .text(`Họ tên: ${contract.buyer.fullName}`, rightX, doc.y)
      .text(`Email: ${contract.buyer.email}`, rightX, doc.y)
      .text(`SĐT: ${contract.buyer.phoneNumber || 'Không có'}`, rightX, doc.y);

    doc.moveDown(1.5);

    doc.x = leftX; // Reset X position to left margin
    doc.fontSize(14).font(semiBoldFont).text('THÔNG TIN HỢP ĐỒNG');
    drawSeparator();

    const contractInfoStartY = doc.y;

    // Left column - Financial Details
    doc
      .fontSize(11)
      .font(normalFont)
      .text(`Giá khởi điểm: ${this.formatCurrency(Number(contract.auction.startingPrice))}`, leftX, contractInfoStartY)
      .text(`Giá trúng đấu giá: ${this.formatCurrency(contract.price)}`, leftX, doc.y)
      .text(`Tiền đặt cọc: ${this.formatCurrency(Number(contract.auction.depositAmountRequired))}`, leftX, doc.y)
      .text(`Phí bán đấu giá: ${this.formatCurrency(Number(contract.auction.saleFee))}`, leftX, doc.y);

    // Right column - Contract Status
    doc
      .fontSize(11)
      .font(normalFont)
      .text(`Trạng thái: ${contract.status.toUpperCase()}`, rightX, contractInfoStartY);
    
    doc.text(`Ngày tạo: ${contract.createdAt.toLocaleString('vi-VN')}`, rightX, doc.y);
    
    if (contract.signedAt) {
      doc.text(`Ngày ký: ${contract.signedAt.toLocaleString('vi-VN')}`, rightX, doc.y);
    }
    if (contract.cancelledAt) {
      doc.text(`Ngày huỷ: ${contract.cancelledAt.toLocaleString('vi-VN')}`, rightX, doc.y);
    }

    doc.moveDown(4);
    doc.x = leftX; // Reset X position to left margin

    doc.fontSize(14).font(semiBoldFont).text('ĐIỀU KHOẢN VÀ ĐIỀU KIỆN');
    drawSeparator();

    const terms = [
      '1. Bên mua đồng ý thanh toán đầy đủ giá trị trúng đấu giá như đã nêu ở trên.',
      '2. Việc thanh toán phải hoàn tất trong vòng 30 ngày kể từ ngày ký hợp đồng.',
      '3. Bên bán có trách nhiệm chuyển giao tài sản sau khi nhận đủ thanh toán.',
      '4. Hai bên cam kết tuân thủ các quy định pháp luật hiện hành.',
      '5. Hợp đồng này có giá trị pháp lý ràng buộc đối với cả hai bên.',
      '6. Mọi tranh chấp phát sinh sẽ được giải quyết theo quy định pháp luật Việt Nam.',
    ];

    doc.fontSize(10).font(normalFont);
    for (const term of terms) {
      doc.text(term, { align: 'justify' }).moveDown(0.3);
    }

    doc.moveDown(2);

    const signatureY = doc.y + 25;

    doc
      .fontSize(11)
      .font(normalFont)
      .text('_________________________', 100, signatureY)
      .text('_________________________', 350, signatureY);

    doc
      .text('Chữ ký Bên Bán', 115, signatureY + 15)
      .text('Chữ ký Bên Mua', 365, signatureY + 15);

    doc
      .text('Ngày: _______________', 115, signatureY + 35)
      .text('Ngày: _______________', 365, signatureY + 35);

    return doc;
  }

  generateContractPdfEnglish(contract: ContractWithRelations): PDFDocument {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    const projectRoot = path.join(__dirname, '..', '..');
    const fontPath = path.join(projectRoot, 'server', 'src', 'assets', 'font', 'Inter', 'static');

    let normalFont = 'Helvetica';
    let boldFont = 'Helvetica-Bold';
    let semiBoldFont = 'Helvetica-Bold';

    try {
      doc.registerFont('Inter-Regular', path.join(fontPath, 'Inter_18pt-Regular.ttf'));
      doc.registerFont('Inter-Bold', path.join(fontPath, 'Inter_18pt-Bold.ttf'));
      doc.registerFont('Inter-SemiBold', path.join(fontPath, 'Inter_18pt-SemiBold.ttf'));
      normalFont = 'Inter-Regular';
      boldFont = 'Inter-Bold';
      semiBoldFont = 'Inter-SemiBold';
    } catch (error) {
      console.warn('Inter fonts not found - using Helvetica fallback. Error: ', error);
    }

    const drawSeparator = (yOffset = 10) => {
      doc.moveDown(0.3);
      const currentY = doc.y + yOffset;
      doc
        .moveTo(50, currentY)
        .lineTo(545, currentY)
        .lineWidth(0.5)
        .strokeColor('#aaaaaa')
        .stroke();
      doc.moveDown(1);
    };

    doc
      .font(boldFont)
      .fontSize(22)
      .text('AUCTION ASSET CONTRACT', { align: 'center' });

    doc
      .fontSize(12)
      .font(normalFont)
      .text(`Contract ID: ${contract.id}`, { align: 'center' })
      .text(
        `Date Created: ${contract.createdAt.toLocaleDateString('en-US', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })}`,
        { align: 'center' },
      )
      .moveDown(1.5);

    doc.fontSize(14).font(semiBoldFont).text('AUCTION INFORMATION');
    drawSeparator();

    doc
      .fontSize(11)
      .font(normalFont)
      .text(`Auction Code: ${contract.auction.code}`)
      .text(`Asset Name: ${contract.auction.name}`)
      .text(`Asset Type: ${contract.auction.assetType}`)
      .text(`Asset Address: ${contract.auction.assetAddress}`)
      .moveDown(1.5);

    doc.fontSize(14).font(semiBoldFont).text('CONTRACT PARTIES');
    drawSeparator();

    const startY = doc.y;
    const leftX = 50;
    const rightX = 310;

    doc.fontSize(12).font(semiBoldFont).text('SELLER (PROPERTY OWNER):', leftX, startY);
    doc
      .fontSize(11)
      .font(normalFont)
      .text(`Name: ${contract.seller.fullName}`, leftX, doc.y)
      .text(`Email: ${contract.seller.email}`, leftX, doc.y)
      .text(`Phone: ${contract.seller.phoneNumber || 'N/A'}`, leftX, doc.y);

    doc.fontSize(12).font(semiBoldFont).text('BUYER (WINNING BIDDER):', rightX, startY);
    doc
      .fontSize(11)
      .font(normalFont)
      .text(`Name: ${contract.buyer.fullName}`, rightX, doc.y)
      .text(`Email: ${contract.buyer.email}`, rightX, doc.y)
      .text(`Phone: ${contract.buyer.phoneNumber || 'N/A'}`, rightX, doc.y);

    doc.moveDown(1.5);

    doc.x = leftX; // Reset X position to left margin
    doc.fontSize(14).font(semiBoldFont).text('CONTRACT INFORMATION');
    drawSeparator();

    const contractInfoStartY = doc.y;

    // Left column - Financial Details
    doc
      .fontSize(11)
      .font(normalFont)
      .text(`Starting Price: ${this.formatCurrencyEnglish(Number(contract.auction.startingPrice))}`, leftX, contractInfoStartY)
      .text(`Winning Bid Amount: ${this.formatCurrencyEnglish(contract.price)}`, leftX, doc.y)
      .text(`Deposit Required: ${this.formatCurrencyEnglish(Number(contract.auction.depositAmountRequired))}`, leftX, doc.y)
      .text(`Auction Fee: ${this.formatCurrencyEnglish(Number(contract.auction.saleFee))}`, leftX, doc.y);

    // Right column - Contract Status
    doc
      .fontSize(11)
      .font(normalFont)
      .text(`Status: ${contract.status}`, rightX, contractInfoStartY);
    
    doc.text(`Created: ${contract.createdAt.toLocaleDateString('en-US')}`, rightX, doc.y);
    
    if (contract.signedAt) {
      doc.text(`Signed: ${contract.signedAt.toLocaleDateString('en-US')}`, rightX, doc.y);
    }
    if (contract.cancelledAt) {
      doc.text(`Cancelled: ${contract.cancelledAt.toLocaleDateString('en-US')}`, rightX, doc.y);
    }

    doc.moveDown(4);
    doc.x = leftX; // Reset X position to left margin

    doc.fontSize(14).font(semiBoldFont).text('TERMS AND CONDITIONS');
    drawSeparator();

    const terms = [
      '1. The buyer agrees to pay the winning bid amount as specified above in full.',
      '2. Payment must be completed within 30 days from the date of contract signing.',
      '3. The seller agrees to transfer ownership upon receipt of full payment.',
      '4. Both parties agree to comply with all applicable laws and regulations.',
      '5. This contract is legally binding upon both parties.',
      '6. Any disputes arising shall be resolved in accordance with Vietnamese law.',
    ];

    doc.fontSize(10).font(normalFont);
    for (const term of terms) {
      doc.text(term, { align: 'justify' }).moveDown(0.3);
    }

    doc.moveDown(2);

    const signatureY = doc.y + 25;

    doc
      .fontSize(11)
      .font(normalFont)
      .text('_________________________', 100, signatureY)
      .text('_________________________', 350, signatureY);

    doc
      .text('Seller Signature', 115, signatureY + 15)
      .text('Buyer Signature', 365, signatureY + 15);

    doc
      .text('Date: _______________', 115, signatureY + 35)
      .text('Date: _______________', 365, signatureY + 35);

    return doc;
  }

  private formatCurrency(amount: number | string): string {
    const numAmount = typeof amount === 'number' ? amount : Number(amount);
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
    }).format(numAmount);
  }

  private formatCurrencyEnglish(amount: number | string): string {
    const numAmount = typeof amount === 'number' ? amount : Number(amount);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
    }).format(numAmount);
  }

}