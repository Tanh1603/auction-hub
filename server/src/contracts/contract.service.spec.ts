import { Test, TestingModule } from '@nestjs/testing';
import { ContractService } from './contract.service';
import { PrismaService } from '../prisma/prisma.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

describe('ContractService', () => {
  let service: ContractService;
  let prismaService: PrismaService;
  let pdfGeneratorService: PdfGeneratorService;

  const mockPrismaService = {
    contract: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    auction: {
      findUnique: jest.fn(),
    },
    auctionBid: {
      findUnique: jest.fn(),
    },
  };

  const mockPdfGeneratorService = {
    generateContractPdf: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: PdfGeneratorService,
          useValue: mockPdfGeneratorService,
        },
      ],
    }).compile();

    service = module.get<ContractService>(ContractService);
    prismaService = module.get<PrismaService>(PrismaService);
    pdfGeneratorService = module.get<PdfGeneratorService>(PdfGeneratorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated contracts for the user', async () => {
      const userId = 'user-123';
      const mockContracts = [
        {
          id: 'contract-1',
          auction: { name: 'Test Auction', code: 'AUC001' },
          seller: { fullName: 'Seller Name' },
          buyer: { fullName: 'Buyer Name' },
          price: 1000000,
          status: 'signed',
          signedAt: new Date(),
          createdAt: new Date(),
        },
      ];

      mockPrismaService.contract.findMany.mockResolvedValue(mockContracts);
      mockPrismaService.contract.count.mockResolvedValue(1);

      const result = await service.findAll({}, userId);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(mockPrismaService.contract.findMany).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return contract details if user has access', async () => {
      const contractId = 'contract-1';
      const userId = 'user-123';
      const mockContract = {
        id: contractId,
        auctionId: 'auction-1',
        auction: { name: 'Test Auction', code: 'AUC001' },
        sellerUserId: userId,
        seller: { fullName: 'Seller Name' },
        buyerUserId: 'buyer-123',
        buyer: { fullName: 'Buyer Name' },
        createdBy: 'admin-123',
        creator: { fullName: 'Admin Name' },
        winningBidId: 'bid-1',
        price: 1000000,
        status: 'signed',
        signedAt: new Date(),
        cancelledAt: null,
        docUrl: 'https://example.com/doc.pdf',
        createdAt: new Date(),
        updatedAt: new Date(),
        winningBid: {},
      };

      mockPrismaService.contract.findUnique.mockResolvedValue(mockContract);

      const result = await service.findOne(contractId, userId);

      expect(result.id).toBe(contractId);
      expect(result.auctionName).toBe('Test Auction');
    });

    it('should throw NotFoundException if contract does not exist', async () => {
      mockPrismaService.contract.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent', 'user-123')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ForbiddenException if user does not have access', async () => {
      const mockContract = {
        id: 'contract-1',
        sellerUserId: 'seller-123',
        buyerUserId: 'buyer-123',
        createdBy: 'admin-123',
        auction: { name: 'Test', code: 'AUC001' },
        seller: { fullName: 'Seller' },
        buyer: { fullName: 'Buyer' },
        creator: { fullName: 'Admin' },
        winningBid: {},
      };

      mockPrismaService.contract.findUnique.mockResolvedValue(mockContract);

      await expect(service.findOne('contract-1', 'unauthorized-user')).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('create', () => {
    it('should create a new contract successfully', async () => {
      const userId = 'admin-123';
      const dto = {
        auctionId: 'auction-1',
        winningBidId: 'bid-1',
        buyerUserId: 'buyer-123',
        price: 1000000,
      };

      const mockAuction = {
        id: 'auction-1',
        propertyOwner: 'seller-123',
      };

      const mockWinningBid = {
        id: 'bid-1',
        auctionId: 'auction-1',
        participant: { userId: 'buyer-123' },
      };

      const mockContract = {
        id: 'contract-1',
        auction: { name: 'Test Auction', code: 'AUC001' },
        seller: { fullName: 'Seller Name' },
        buyer: { fullName: 'Buyer Name' },
        creator: { fullName: 'Admin Name' },
        price: 1000000,
        status: 'draft',
      };

      mockPrismaService.auction.findUnique.mockResolvedValue(mockAuction);
      mockPrismaService.auctionBid.findUnique.mockResolvedValue(mockWinningBid);
      mockPrismaService.contract.findFirst.mockResolvedValue(null);
      mockPrismaService.contract.create.mockResolvedValue(mockContract);

      const result = await service.create(dto, userId);

      expect(result.message).toBe('Contract created successfully');
      expect(result.data.id).toBe('contract-1');
    });

    it('should throw NotFoundException if auction does not exist', async () => {
      mockPrismaService.auction.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          {
            auctionId: 'non-existent',
            winningBidId: 'bid-1',
            buyerUserId: 'buyer-123',
            price: 1000000,
          },
          'admin-123'
        )
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('sign', () => {
    it('should sign a draft contract', async () => {
      const contractId = 'contract-1';
      const userId = 'buyer-123';
      const mockContract = {
        id: contractId,
        sellerUserId: 'seller-123',
        buyerUserId: userId,
        createdBy: 'admin-123',
        status: 'draft',
      };

      const mockSignedContract = {
        ...mockContract,
        status: 'signed',
        signedAt: new Date(),
        auction: { name: 'Test', code: 'AUC001' },
      };

      mockPrismaService.contract.findUnique.mockResolvedValue(mockContract);
      mockPrismaService.contract.update.mockResolvedValue(mockSignedContract);

      const result = await service.sign(contractId, {}, userId);

      expect(result.message).toBe('Contract signed successfully');
      expect(result.data.status).toBe('signed');
    });

    it('should throw BadRequestException if contract is not in draft status', async () => {
      const mockContract = {
        id: 'contract-1',
        sellerUserId: 'seller-123',
        buyerUserId: 'buyer-123',
        createdBy: 'admin-123',
        status: 'signed',
      };

      mockPrismaService.contract.findUnique.mockResolvedValue(mockContract);

      await expect(service.sign('contract-1', {}, 'buyer-123')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('cancel', () => {
    it('should cancel a contract', async () => {
      const contractId = 'contract-1';
      const userId = 'buyer-123';
      const mockContract = {
        id: contractId,
        sellerUserId: 'seller-123',
        buyerUserId: userId,
        createdBy: 'admin-123',
        status: 'draft',
      };

      const mockCancelledContract = {
        ...mockContract,
        status: 'cancelled',
        cancelledAt: new Date(),
        auction: { name: 'Test', code: 'AUC001' },
      };

      mockPrismaService.contract.findUnique.mockResolvedValue(mockContract);
      mockPrismaService.contract.update.mockResolvedValue(mockCancelledContract);

      const result = await service.cancel(
        contractId,
        { reason: 'Test cancellation reason' },
        userId
      );

      expect(result.message).toBe('Contract cancelled successfully');
      expect(result.data.status).toBe('cancelled');
    });

    it('should throw BadRequestException if contract is already cancelled', async () => {
      const mockContract = {
        id: 'contract-1',
        sellerUserId: 'seller-123',
        buyerUserId: 'buyer-123',
        createdBy: 'admin-123',
        status: 'cancelled',
      };

      mockPrismaService.contract.findUnique.mockResolvedValue(mockContract);

      await expect(
        service.cancel('contract-1', { reason: 'Test reason' }, 'buyer-123')
      ).rejects.toThrow(BadRequestException);
    });
  });
});

