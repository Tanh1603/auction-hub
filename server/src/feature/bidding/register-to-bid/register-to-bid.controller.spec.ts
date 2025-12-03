// // server/src/feature/bidding/register-to-bid/register-to-bid.controller.spec.ts
// import { Test, TestingModule } from '@nestjs/testing';
// import { RegisterToBidController } from './register-to-bid.controller';
// import { RegisterToBidService } from './register-to-bid.service';

// describe('RegisterToBidController', () => {
//   let controller: RegisterToBidController;
//   let service: RegisterToBidService;

//   const mockUser = {
//     id: 'user-123',
//     email: 'test@example.com',
//   };

//   const mockCreateDto = {
//     itemId: 'item-456',
//     documents: ['document1.pdf'],
//   };

//   const mockRegistration = {
//     id: 'reg-789',
//     userId: mockUser.id,
//     itemId: mockCreateDto.itemId,
//     registeredAt: new Date(),
//     submittedAt: new Date(),
//   };

//   beforeEach(async () => {
//     const module: TestingModule = await Test.createTestingModule({
//       controllers: [RegisterToBidController],
//       providers: [
//         {
//           provide: RegisterToBidService,
//           useValue: {
//             create: jest.fn(),
//             getRegistrationStatusForAdmin: jest.fn(),
//           },
//         },
//       ],
//     }).compile();

//     controller = module.get<RegisterToBidController>(RegisterToBidController);
//     service = module.get<RegisterToBidService>(RegisterToBidService);
//   });

//   afterEach(() => {
//     jest.clearAllMocks();
//   });

//   describe('create', () => {
//     it('should accept item id and create registration (submitted)', async () => {
//       jest.spyOn(service, 'create').mockResolvedValueOnce(mockRegistration as any);

//       const result = await controller.create(mockCreateDto as any, mockUser as any);

//       expect(result).toEqual(mockRegistration);
//       expect(result.submittedAt).toBeDefined();
//       expect(service.create).toHaveBeenCalledWith(mockCreateDto, mockUser);
//     });

//     it('should pass correct itemId and documents to service', async () => {
//       jest.spyOn(service, 'create').mockResolvedValueOnce(mockRegistration as any);

//       await controller.create(mockCreateDto as any, mockUser as any);

//       expect(service.create).toHaveBeenCalledWith(
//         {
//           itemId: 'item-456',
//           documents: ['document1.pdf'],
//         },
//         mockUser,
//       );
//     });

//     it('should return registration with submittedAt in response', async () => {
//       const registrationWithSubmitted = {
//         ...mockRegistration,
//         submittedAt: new Date(),
//       };

//       jest
//         .spyOn(service, 'create')
//         .mockResolvedValueOnce(registrationWithSubmitted as any);

//       const result = await controller.create(mockCreateDto as any, mockUser as any);

//       expect(result.submittedAt).toBeDefined();
//       expect(result.userId).toBe(mockUser.id);
//       expect(result.itemId).toBe(mockCreateDto.itemId);
//     });
//   });

//   describe('getRegistrationStatus', () => {
//     it('should retrieve registration status for a user', async () => {
//       const mockRegistrations = [mockRegistration];

//       jest
//         .spyOn(service, 'getRegistrationStatusForAdmin')
//         .mockResolvedValueOnce(mockRegistrations as any);

//       const result = await controller.listForUser(mockUser.id);

//       expect(result).toEqual(mockRegistrations);
//       expect(service.getRegistrationStatusForAdmin).toHaveBeenCalledWith(mockUser.id);
//     });

//     it('should return multiple registrations for user', async () => {
//       const mockRegistrations = [
//         {
//           ...mockRegistration,
//           id: 'reg-1',
//           submittedAt: new Date(),
//         },
//         {
//           ...mockRegistration,
//           id: 'reg-2',
//           itemId: 'item-789',
//           confirmedAt: new Date(),
//         },
//       ];

//       jest
//         .spyOn(service, 'getRegistrationStatusForAdmin')
//         .mockResolvedValueOnce(mockRegistrations as any);

//       const result = await controller.listForUser(mockUser.id);

//       expect(result).toHaveLength(2);
//       expect(result[0].submittedAt).toBeDefined();
//       expect(result[1].confirmedAt).toBeDefined();
//     });
//   });
// });
