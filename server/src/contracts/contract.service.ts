import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ContractQueryDto } from './dto/contract-query.dto';
import { SignContractDto } from './dto/sign-contract.dto';
import { CancelContractDto } from './dto/cancel-contract.dto';
import {
  ContractDetailDto,
  ContractListItemDto,
} from './dto/contract-detail.dto';
import { Prisma } from '../../generated';
import { getPaginationOptions } from '../common/utils/pagination.util';
import {
  getPropertyOwnerId,
  getPropertyOwnerSnapshot,
} from '../common/types/property-owner-snapshot.interface';

@Injectable()
export class ContractService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfGenerator: PdfGeneratorService
  ) {}

  async findAll(query: ContractQueryDto, userId: string, userRole?: string) {
    const pagination = getPaginationOptions(query);

    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    const where: Prisma.ContractWhereInput = isAdmin
      ? {}
      : {
          OR: [
            { propertyOwnerUserId: userId },
            { buyerUserId: userId },
            { createdBy: userId },
          ],
        };

    if (query.status) {
      where.status = query.status;
    }

    if (query.auctionId) {
      where.auctionId = query.auctionId;
    }

    if (query.buyerId) {
      where.buyerUserId = query.buyerId;
    }

    if (query.sellerId) {
      where.propertyOwnerUserId = query.sellerId;
    }

    const [items, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        ...pagination,
        include: {
          auction: { select: { name: true, code: true } },
          propertyOwner: { select: { fullName: true } },
          buyer: { select: { fullName: true } },
        },
      }),
      this.prisma.contract.count({ where }),
    ]);

    const data: ContractListItemDto[] = items.map((contract) => ({
      id: contract.id,
      auctionName: contract.auction.name,
      auctionCode: contract.auction.code,
      sellerName: contract.propertyOwner?.fullName ?? 'Unknown',
      buyerName: contract.buyer.fullName,
      price: Number(contract.price),
      status: contract.status,
      signedAt: contract.signedAt,
      createdAt: contract.createdAt,
    }));

    return {
      data,
      meta: {
        total,
        page: query.page ?? 1,
        limit: query.limit ?? 10,
        totalPages: Math.ceil(total / (query.limit ?? 10)),
      },
    };
  }

  async findOne(
    id: string,
    userId: string,
    userRole?: string
  ): Promise<ContractDetailDto> {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: {
        auction: { select: { name: true, code: true, propertyOwner: true } },
        propertyOwner: { select: { fullName: true, identityNumber: true } },
        buyer: { select: { fullName: true, identityNumber: true } },
        winningBid: true,
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    this.checkAccess(contract, userId, userRole);

    // Debug: Log the raw data to trace property owner retrieval
    console.log(
      'DEBUG contract.propertyOwnerUserId:',
      contract.propertyOwnerUserId
    );
    console.log(
      'DEBUG contract.propertyOwner (User relation):',
      contract.propertyOwner
    );
    console.log(
      'DEBUG contract.auction.propertyOwner (JSON):',
      contract.auction.propertyOwner
    );

    const ownerSnapshot = getPropertyOwnerSnapshot(
      contract.auction.propertyOwner
    );
    console.log('DEBUG ownerSnapshot (parsed):', ownerSnapshot);

    const sellerName =
      contract.propertyOwner?.fullName ?? ownerSnapshot?.fullName ?? 'Unknown';
    const sellerIdentityNumber =
      contract.propertyOwner?.identityNumber ?? ownerSnapshot?.identityNumber;

    console.log('DEBUG sellerName:', sellerName);
    console.log('DEBUG sellerIdentityNumber:', sellerIdentityNumber);

    return {
      id: contract.id,
      auctionId: contract.auctionId,
      auctionName: contract.auction.name,
      auctionCode: contract.auction.code,
      winningBidId: contract.winningBidId,
      sellerUserId: contract.propertyOwnerUserId,
      sellerName,
      sellerIdentityNumber,
      buyerUserId: contract.buyerUserId,
      buyerName: contract.buyer.fullName,
      buyerIdentityNumber: contract.buyer.identityNumber,
      price: Number(contract.price),
      status: contract.status,
      signedAt: contract.signedAt,
      cancelledAt: contract.cancelledAt,
      docUrl: contract.docUrl,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
    };
  }

  async create(dto: CreateContractDto, userId: string) {
    const auction = await this.prisma.auction.findUnique({
      where: { id: dto.auctionId },
    });

    if (!auction) {
      throw new NotFoundException('Auction not found');
    }

    const winningBid = await this.prisma.auctionBid.findUnique({
      where: { id: dto.winningBidId },
      include: { participant: true },
    });

    if (!winningBid) {
      throw new NotFoundException('Winning bid not found');
    }

    if (winningBid.auctionId !== dto.auctionId) {
      throw new BadRequestException(
        'Winning bid does not belong to this auction'
      );
    }

    if (winningBid.participant.userId !== dto.buyerUserId) {
      throw new BadRequestException('Buyer must be the winning bidder');
    }

    const existingContract = await this.prisma.contract.findFirst({
      where: { auctionId: dto.auctionId },
    });

    if (existingContract) {
      throw new BadRequestException(
        'A contract already exists for this auction'
      );
    }

    const contract = await this.prisma.contract.create({
      data: {
        auctionId: dto.auctionId,
        winningBidId: dto.winningBidId,
        propertyOwnerUserId: getPropertyOwnerId(auction.propertyOwner),
        buyerUserId: dto.buyerUserId,
        createdBy: userId,
        price: new Prisma.Decimal(dto.price),
        status: 'draft',
        docUrl: dto.docUrl,
      },
      include: {
        auction: { select: { name: true, code: true, propertyOwner: true } },
        propertyOwner: { select: { fullName: true } },
        buyer: { select: { fullName: true } },
      },
    });

    const ownerSnapshot = getPropertyOwnerSnapshot(
      contract.auction.propertyOwner
    );

    return {
      message: 'Contract created successfully',
      data: {
        id: contract.id,
        auctionName: contract.auction.name,
        auctionCode: contract.auction.code,
        sellerName:
          contract.propertyOwner?.fullName ??
          ownerSnapshot?.fullName ??
          'Unknown',
        buyerName: contract.buyer.fullName,
        price: Number(contract.price),
        status: contract.status,
      },
    };
  }

  async update(
    id: string,
    dto: UpdateContractDto,
    userId: string,
    userRole?: string
  ) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    this.checkAccess(contract, userId, userRole);

    if (
      dto.status &&
      !this.isValidStatusTransition(contract.status, dto.status)
    ) {
      throw new BadRequestException(
        `Cannot transition from ${contract.status} to ${dto.status}`
      );
    }

    const updatedContract = await this.prisma.contract.update({
      where: { id },
      data: {
        status: dto.status,
        docUrl: dto.docUrl,
      },
      include: {
        auction: { select: { name: true, code: true } },
      },
    });

    return {
      message: 'Contract updated successfully',
      data: {
        id: updatedContract.id,
        auctionCode: updatedContract.auction.code,
        status: updatedContract.status,
        docUrl: updatedContract.docUrl,
      },
    };
  }

  async sign(
    id: string,
    dto: SignContractDto,
    userId: string,
    userRole?: string
  ) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    this.checkAccess(contract, userId, userRole);

    if (contract.status !== 'draft') {
      throw new BadRequestException('Only draft contracts can be signed');
    }

    const signedContract = await this.prisma.contract.update({
      where: { id },
      data: {
        status: 'signed',
        signedAt: new Date(),
        docUrl: dto.docUrl || contract.docUrl,
      },
      include: {
        auction: { select: { name: true, code: true } },
      },
    });

    return {
      message: 'Contract signed successfully',
      data: {
        id: signedContract.id,
        auctionCode: signedContract.auction.code,
        status: signedContract.status,
        signedAt: signedContract.signedAt,
      },
    };
  }

  async cancel(
    id: string,
    dto: CancelContractDto,
    userId: string,
    userRole?: string
  ) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    this.checkAccess(contract, userId, userRole);

    if (contract.status === 'completed') {
      throw new BadRequestException('Cannot cancel a completed contract');
    }

    if (contract.status === 'cancelled') {
      throw new BadRequestException('Contract is already cancelled');
    }

    const cancelledContract = await this.prisma.contract.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
      },
      include: {
        auction: { select: { name: true, code: true } },
      },
    });

    return {
      message: 'Contract cancelled successfully',
      data: {
        id: cancelledContract.id,
        auctionCode: cancelledContract.auction.code,
        status: cancelledContract.status,
        cancelledAt: cancelledContract.cancelledAt,
        reason: dto.reason,
      },
    };
  }

  async exportToPdf(id: string, userId: string, userRole?: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: {
        auction: true,
        propertyOwner: true,
        buyer: true,
        winningBid: true,
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    this.checkAccess(contract, userId, userRole);

    const contractForPdf = {
      ...contract,
      price: Number(contract.price),
    };

    return this.pdfGenerator.generateContractPdf(contractForPdf);
  }

  async exportToPdfEnglish(id: string, userId: string, userRole?: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: {
        auction: true,
        propertyOwner: true,
        buyer: true,
        winningBid: true,
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    this.checkAccess(contract, userId, userRole);

    const contractForPdf = {
      ...contract,
      price: Number(contract.price),
    };

    return this.pdfGenerator.generateContractPdfEnglish(contractForPdf);
  }

  private checkAccess(
    contract: {
      propertyOwnerUserId: string | null;
      buyerUserId: string;
      createdBy: string;
    },
    userId: string,
    userRole?: string
  ): void {
    // Allow admins and super_admins to bypass ownership checks
    if (userRole === 'admin' || userRole === 'super_admin') {
      return;
    }

    const hasAccess =
      contract.propertyOwnerUserId === userId ||
      contract.buyerUserId === userId ||
      contract.createdBy === userId;

    if (!hasAccess) {
      throw new ForbiddenException(
        'You do not have permission to access this contract'
      );
    }
  }

  private isValidStatusTransition(
    currentStatus: string,
    newStatus: string
  ): boolean {
    const validTransitions: Record<string, string[]> = {
      draft: ['signed', 'cancelled'],
      signed: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
    };

    return validTransitions[currentStatus]?.includes(newStatus) ?? false;
  }
}
