import { Test, TestingModule } from '@nestjs/testing';
import { ContractController } from './contract.controller';
import { ContractService } from './contract.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { ContractAccessGuard } from './guards/contract-access.guard';

describe('ContractController', () => {
  let controller: ContractController;
  let service: ContractService;

  const mockContractService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    sign: jest.fn(),
    cancel: jest.fn(),
    exportToPdf: jest.fn(),
  };

  const mockAuthGuard = {
    canActivate: jest.fn(() => true),
  };

  const mockContractAccessGuard = {
    canActivate: jest.fn(() => true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContractController],
      providers: [
        {
          provide: ContractService,
          useValue: mockContractService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .overrideGuard(ContractAccessGuard)
      .useValue(mockContractAccessGuard)
      .compile();

    controller = module.get<ContractController>(ContractController);
    service = module.get<ContractService>(ContractService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all contracts for the user', async () => {
      const mockResult = {
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      };

      mockContractService.findAll.mockResolvedValue(mockResult);

      const user = { id: 'user-123', email: 'test@test.com', full_name: 'Test User', avatar: '' };
      const result = await controller.findAll({}, user);

      expect(result.message).toBe('Contracts retrieved successfully');
      expect(service.findAll).toHaveBeenCalledWith({}, 'user-123');
    });
  });

  describe('findOne', () => {
    it('should return a single contract', async () => {
      const mockContract = {
        id: 'contract-1',
        auctionName: 'Test Auction',
        price: 1000000,
        status: 'signed',
      };

      mockContractService.findOne.mockResolvedValue(mockContract);

      const user = { id: 'user-123', email: 'test@test.com', full_name: 'Test User', avatar: '' };
      const result = await controller.findOne('contract-1', user);

      expect(result.message).toBe('Contract retrieved successfully');
      expect(result.data).toEqual(mockContract);
      expect(service.findOne).toHaveBeenCalledWith('contract-1', 'user-123');
    });
  });

  describe('create', () => {
    it('should create a new contract', async () => {
      const createDto = {
        auctionId: 'auction-1',
        winningBidId: 'bid-1',
        buyerUserId: 'buyer-123',
        price: 1000000,
      };

      const mockResult = {
        message: 'Contract created successfully',
        data: { id: 'contract-1' },
      };

      mockContractService.create.mockResolvedValue(mockResult);

      const user = { id: 'admin-123', email: 'admin@test.com', full_name: 'Admin', avatar: '' };
      const result = await controller.create(createDto, user);

      expect(result).toEqual(mockResult);
      expect(service.create).toHaveBeenCalledWith(createDto, 'admin-123');
    });
  });

  describe('update', () => {
    it('should update a contract', async () => {
      const updateDto = { status: 'signed' as any };
      const mockResult = {
        message: 'Contract updated successfully',
        data: { id: 'contract-1', status: 'signed' },
      };

      mockContractService.update.mockResolvedValue(mockResult);

      const user = { id: 'user-123', email: 'test@test.com', full_name: 'Test User', avatar: '' };
      const result = await controller.update('contract-1', updateDto, user);

      expect(result).toEqual(mockResult);
      expect(service.update).toHaveBeenCalledWith('contract-1', updateDto, 'user-123');
    });
  });

  describe('sign', () => {
    it('should sign a contract', async () => {
      const signDto = { docUrl: 'https://example.com/doc.pdf' };
      const mockResult = {
        message: 'Contract signed successfully',
        data: { id: 'contract-1', status: 'signed' },
      };

      mockContractService.sign.mockResolvedValue(mockResult);

      const user = { id: 'user-123', email: 'test@test.com', full_name: 'Test User', avatar: '' };
      const result = await controller.sign('contract-1', signDto, user);

      expect(result).toEqual(mockResult);
      expect(service.sign).toHaveBeenCalledWith('contract-1', signDto, 'user-123');
    });
  });

  describe('cancel', () => {
    it('should cancel a contract', async () => {
      const cancelDto = { reason: 'Test cancellation reason' };
      const mockResult = {
        message: 'Contract cancelled successfully',
        data: { id: 'contract-1', status: 'cancelled' },
      };

      mockContractService.cancel.mockResolvedValue(mockResult);

      const user = { id: 'user-123', email: 'test@test.com', full_name: 'Test User', avatar: '' };
      const result = await controller.cancel('contract-1', cancelDto, user);

      expect(result).toEqual(mockResult);
      expect(service.cancel).toHaveBeenCalledWith('contract-1', cancelDto, 'user-123');
    });
  });

  describe('exportToPdf', () => {
    it('should export contract as PDF', async () => {
      const mockPdfDoc = {
        pipe: jest.fn(),
        end: jest.fn(),
      };

      mockContractService.exportToPdf.mockResolvedValue(mockPdfDoc);

      const user = { id: 'user-123', email: 'test@test.com', full_name: 'Test User', avatar: '' };
      const mockResponse = {
        setHeader: jest.fn(),
      };

      await controller.exportToPdf('contract-1', user, mockResponse as any);

      expect(service.exportToPdf).toHaveBeenCalledWith('contract-1', 'user-123');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(mockPdfDoc.pipe).toHaveBeenCalledWith(mockResponse);
      expect(mockPdfDoc.end).toHaveBeenCalled();
    });
  });
});

