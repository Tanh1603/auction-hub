import { Test, TestingModule } from '@nestjs/testing';
import { RegisterToBidController } from './register-to-bid.controller';
import { RegisterToBidService } from './register-to-bid.service';
import { BidRegistrationStatus } from '@prisma/client';

describe('RegisterToBidController', () => {
  let controller: RegisterToBidController;
  let service: RegisterToBidService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockCreateDto = {
    itemId: 'item-456',
    documents: ['document1.pdf'],
  };

  const mockRegistration = {
    id: 'reg-789',
    userId: mockUser.id,
    itemId: mockCreateDto.itemId,
    status: BidRegistrationStatus.PENDING,
    documents: mockCreateDto.documents,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RegisterToBidController],
      providers: [
        {
          provide: RegisterToBidService,
          useValue: {
            create: jest.fn(),
            getRegistrationStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<RegisterToBidController>(RegisterToBidController);
    service = module.get<RegisterToBidService>(RegisterToBidService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should accept item id and create registration with PENDING status', async () => {
      jest.spyOn(service, 'create').mockResolvedValueOnce(mockRegistration as any);

      const result = await controller.create(mockCreateDto, mockUser as any);

      expect(result).toEqual(mockRegistration);
      expect(result.status).toBe(BidRegistrationStatus.PENDING);
      expect(service.create).toHaveBeenCalledWith(mockCreateDto, mockUser);
    });

    it('should pass correct itemId and documents to service', async () => {
      jest.spyOn(service, 'create').mockResolvedValueOnce(mockRegistration as any);

      await controller.create(mockCreateDto, mockUser as any);

      expect(service.create).toHaveBeenCalledWith(
        {
          itemId: 'item-456',
          documents: ['document1.pdf'],
        },
        mockUser,
      );
    });

    it('should return registration with PENDING status in response', async () => {
      const registrationWithPendingStatus = {
        ...mockRegistration,
        status: BidRegistrationStatus.PENDING,
      };

      jest
        .spyOn(service, 'create')
        .mockResolvedValueOnce(registrationWithPendingStatus as any);

      const result = await controller.create(mockCreateDto, mockUser as any);

      expect(result.status).toBe(BidRegistrationStatus.PENDING);
      expect(result.userId).toBe(mockUser.id);
      expect(result.itemId).toBe(mockCreateDto.itemId);
    });
  });

  describe('getRegistrationStatus', () => {
    it('should retrieve registration status for a user', async () => {
      const mockRegistrations = [mockRegistration];

      jest
        .spyOn(service, 'getRegistrationStatus')
        .mockResolvedValueOnce(mockRegistrations as any);

      const result = await controller.getRegistrationStatus(mockUser.id);

      expect(result).toEqual(mockRegistrations);
      expect(service.getRegistrationStatus).toHaveBeenCalledWith(mockUser.id);
    });

    it('should return multiple registrations for user', async () => {
      const mockRegistrations = [
        {
          ...mockRegistration,
          id: 'reg-1',
          status: BidRegistrationStatus.PENDING,
        },
        {
          ...mockRegistration,
          id: 'reg-2',
          itemId: 'item-789',
          status: BidRegistrationStatus.APPROVED,
        },
      ];

      jest
        .spyOn(service, 'getRegistrationStatus')
        .mockResolvedValueOnce(mockRegistrations as any);

      const result = await controller.getRegistrationStatus(mockUser.id);

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe(BidRegistrationStatus.PENDING);
      expect(result[1].status).toBe(BidRegistrationStatus.APPROVED);
    });
  });
});
