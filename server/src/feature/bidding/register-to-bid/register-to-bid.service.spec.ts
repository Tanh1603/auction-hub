import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { RegisterToBidService } from './register-to-bid.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { BidRegistrationStatus } from '@prisma/client';

describe('RegisterToBidService', () => {
  let service: RegisterToBidService;
  let prismaService: PrismaService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockCreateDto = {
    itemId: 'item-456',
    documents: ['document1.pdf', 'document2.pdf'],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegisterToBidService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
            registerToBid: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              delete: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RegisterToBidService>(RegisterToBidService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should successfully create a registration with PENDING status', async () => {
      const mockRegistration = {
        id: 'reg-789',
        userId: mockUser.id,
        itemId: mockCreateDto.itemId,
        status: BidRegistrationStatus.PENDING,
        documents: mockCreateDto.documents,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce(mockUser as any);

      jest.spyOn(prismaService, '$transaction').mockImplementationOnce(async (callback) => {
        jest.spyOn(prismaService.registerToBid, 'findFirst').mockResolvedValueOnce(null);
        jest.spyOn(prismaService.registerToBid, 'create').mockResolvedValueOnce(mockRegistration);
        return callback({
          registerToBid: prismaService.registerToBid,
        } as any);
      });

      const result = await service.create(mockCreateDto, mockUser as any);

      expect(result).toEqual(mockRegistration);
      expect(result.status).toBe(BidRegistrationStatus.PENDING);
      expect(result.userId).toBe(mockUser.id);
      expect(result.itemId).toBe(mockCreateDto.itemId);
    });

    it('should throw NotFoundException if user does not exist in system', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce(null);

      await expect(service.create(mockCreateDto, mockUser as any)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
    });

    it('should throw ConflictException if user has pending registration for same item', async () => {
      const existingRegistration = {
        id: 'reg-existing',
        userId: mockUser.id,
        itemId: mockCreateDto.itemId,
        status: BidRegistrationStatus.PENDING,
      };

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce(mockUser as any);

      jest.spyOn(prismaService, '$transaction').mockImplementationOnce(async (callback) => {
        jest
          .spyOn(prismaService.registerToBid, 'findFirst')
          .mockResolvedValueOnce(existingRegistration as any);
        return callback({
          registerToBid: prismaService.registerToBid,
        } as any);
      });

      await expect(service.create(mockCreateDto, mockUser as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException if user has approved registration for same item', async () => {
      const existingRegistration = {
        id: 'reg-existing',
        userId: mockUser.id,
        itemId: mockCreateDto.itemId,
        status: BidRegistrationStatus.APPROVED,
      };

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce(mockUser as any);

      jest.spyOn(prismaService, '$transaction').mockImplementationOnce(async (callback) => {
        jest
          .spyOn(prismaService.registerToBid, 'findFirst')
          .mockResolvedValueOnce(existingRegistration as any);
        return callback({
          registerToBid: prismaService.registerToBid,
        } as any);
      });

      await expect(service.create(mockCreateDto, mockUser as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should delete rejected registration and create new one', async () => {
      const rejectedRegistration = {
        id: 'reg-rejected',
        userId: mockUser.id,
        itemId: mockCreateDto.itemId,
        status: BidRegistrationStatus.REJECTED,
      };

      const newRegistration = {
        id: 'reg-new',
        userId: mockUser.id,
        itemId: mockCreateDto.itemId,
        status: BidRegistrationStatus.PENDING,
        documents: mockCreateDto.documents,
      };

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce(mockUser as any);

      jest.spyOn(prismaService, '$transaction').mockImplementationOnce(async (callback) => {
        jest
          .spyOn(prismaService.registerToBid, 'findFirst')
          .mockResolvedValueOnce(rejectedRegistration as any);
        jest.spyOn(prismaService.registerToBid, 'delete').mockResolvedValueOnce(undefined as any);
        jest.spyOn(prismaService.registerToBid, 'create').mockResolvedValueOnce(newRegistration as any);
        return callback({
          registerToBid: prismaService.registerToBid,
        } as any);
      });

      const result = await service.create(mockCreateDto, mockUser as any);

      expect(result.status).toBe(BidRegistrationStatus.PENDING);
      expect(result.id).toBe('reg-new');
    });
  });

  describe('getRegistrationStatus', () => {
    it('should return all registrations for a user', async () => {
      const mockRegistrations = [
        {
          id: 'reg-1',
          userId: mockUser.id,
          itemId: 'item-1',
          status: BidRegistrationStatus.PENDING,
        },
        {
          id: 'reg-2',
          userId: mockUser.id,
          itemId: 'item-2',
          status: BidRegistrationStatus.APPROVED,
        },
      ];

      jest
        .spyOn(prismaService.registerToBid, 'findMany')
        .mockResolvedValueOnce(mockRegistrations as any);

      const result = await service.getRegistrationStatusForAdmin(mockUser.id);

      expect(result).toEqual(mockRegistrations);
      expect(result).toHaveLength(2);
      expect(prismaService.registerToBid.findMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        include: { item: true },
      });
    });

    it('should throw NotFoundException if user has no registrations', async () => {
      jest.spyOn(prismaService.registerToBid, 'findMany').mockResolvedValueOnce([]);

      await expect(service.getRegistrationStatusForAdmin(mockUser.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
