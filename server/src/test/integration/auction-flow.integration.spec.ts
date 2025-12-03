import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from '../../common/services/email.service';
import { SupabaseService } from '../../supabase/supabase.service';

// Import modules
import { AuthModule } from '../../auth/auth.module';
import { RegisterToBidModule } from '../../feature/bidding/register-to-bid/register-to-bid.module';
import { ManualBidModule } from '../../feature/bidding/manual-bid/manual-bid.module';
import { AuctionFinalizationModule } from '../../feature/auction-finalization/auction-finalization.module';
import { CommonModule } from '../../common/common.module';

// Types
import { AuctionStatus, UserType, User, Auction } from '../../../generated';

describe('Auction Flow Integration Tests', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let emailService: EmailService;

  // Test data
  let testUsers: {
    auctioneer: User;
    bidder1: User;
    bidder2: User;
    bidder3: User;
    admin: User;
  };

  let testAuction: Auction;
  let authTokens: {
    auctioneer: string;
    bidder1: string;
    bidder2: string;
    bidder3: string;
    admin: string;
  };

  // Helper function to create JWT tokens for testing
  const createTestJWT = (user: User, role = 'user'): string => {
    const payload = {
      sub: user.id,
      email: user.email,
      full_name: user.fullName,
      aud: 'authenticated',
      role: role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
    };

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not found');
    }

    return jwt.sign(payload, jwtSecret, { algorithm: 'HS256' });
  };

  // Helper function to create dates relative to now
  const createDate = (
    daysOffset: number,
    hoursOffset = 0,
    minutesOffset = 0
  ): Date => {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    date.setHours(date.getHours() + hoursOffset);
    date.setMinutes(date.getMinutes() + minutesOffset);
    return date;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              JWT_SECRET: process.env.JWT_SECRET,
              DATABASE_URL: process.env.DATABASE_URL,
              EMAIL_PROVIDER: 'smtp', // Use SMTP for testing
              SMTP_HOST: 'smtp.ethereal.email', // Use ethereal for testing
              SMTP_PORT: '587',
              SMTP_USER: 'test@test.com',
              SMTP_PASS: 'testpass',
              SMTP_FROM_EMAIL: 'test@auctionhub.test',
              SMTP_FROM_NAME: 'Auction Hub Test',
            }),
          ],
        }),
        AuthModule,
        RegisterToBidModule,
        ManualBidModule,
        AuctionFinalizationModule,
        CommonModule,
      ],
    })
      .overrideProvider(SupabaseService)
      .useValue({
        // Mock Supabase service for testing
        auth: {
          signUp: jest.fn().mockResolvedValue({
            error: null,
            data: { user: { id: 'test-id' } },
          }),
          signInWithPassword: jest.fn().mockImplementation(() => ({
            data: {
              session: {
                access_token: 'mock-token',
                refresh_token: 'mock-refresh',
                expires_in: 3600,
              },
            },
            error: null,
          })),
          resetPasswordForEmail: jest.fn().mockResolvedValue({ error: null }),
          resend: jest.fn().mockResolvedValue({ error: null }),
          verifyOtp: jest.fn().mockResolvedValue({ error: null }),
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    emailService = moduleFixture.get<EmailService>(EmailService);

    // Mock email service to prevent actual email sending during tests
    jest.spyOn(emailService, 'sendAuctionResultEmail').mockResolvedValue();
    jest.spyOn(emailService, 'sendBulkAuctionResultEmails').mockResolvedValue();
  });

  beforeEach(async () => {
    // Clean database before each test
    await prismaService.$transaction([
      prismaService.contract.deleteMany(),
      prismaService.auctionAuditLog.deleteMany(),
      prismaService.autoBidSetting.deleteMany(),
      prismaService.auctionBid.deleteMany(),
      prismaService.auctionParticipant.deleteMany(),
      prismaService.auctionRelation.deleteMany(),
      prismaService.auctionAttachment.deleteMany(),
      prismaService.auctionImage.deleteMany(),
      prismaService.auction.deleteMany(),
      prismaService.user.deleteMany(),
    ]);

    // Create test users
    testUsers = {
      auctioneer: await prismaService.user.create({
        data: {
          email: 'auctioneer@test.com',
          fullName: 'Test Auctioneer',
          userType: UserType.business,
          phoneNumber: '+84901234567',
          identityNumber: 'DN001234567',
          isVerified: true,
          updatedAt: new Date(),
        },
      }),
      bidder1: await prismaService.user.create({
        data: {
          email: 'bidder1@test.com',
          fullName: 'Test Bidder 1',
          userType: UserType.individual,
          phoneNumber: '+84912345678',
          identityNumber: '123456789012',
          isVerified: true,
          updatedAt: new Date(),
        },
      }),
      bidder2: await prismaService.user.create({
        data: {
          email: 'bidder2@test.com',
          fullName: 'Test Bidder 2',
          userType: UserType.individual,
          phoneNumber: '+84923456789',
          identityNumber: '234567890123',
          isVerified: true,
          updatedAt: new Date(),
        },
      }),
      bidder3: await prismaService.user.create({
        data: {
          email: 'bidder3@test.com',
          fullName: 'Test Bidder 3',
          userType: UserType.business,
          phoneNumber: '+84934567890',
          identityNumber: 'DN987654321',
          taxId: '9876543210',
          isVerified: true,
          updatedAt: new Date(),
        },
      }),
      admin: await prismaService.user.create({
        data: {
          email: 'admin@test.com',
          fullName: 'Test Admin',
          userType: UserType.business,
          phoneNumber: '+84945678901',
          identityNumber: 'AD123456789',
          isVerified: true,
          updatedAt: new Date(),
        },
      }),
    };

    // Generate JWT tokens for test users
    authTokens = {
      auctioneer: createTestJWT(testUsers.auctioneer, 'auctioneer'),
      bidder1: createTestJWT(testUsers.bidder1, 'user'),
      bidder2: createTestJWT(testUsers.bidder2, 'user'),
      bidder3: createTestJWT(testUsers.bidder3, 'user'),
      admin: createTestJWT(testUsers.admin, 'admin'),
    };

    // Create test auction
    testAuction = await prismaService.auction.create({
      data: {
        code: 'TEST001',
        name: 'Test Auction - Integration Test',
        propertyOwner: testUsers.auctioneer.id,
        assetType: 'secured_asset',
        status: AuctionStatus.scheduled,
        saleStartAt: createDate(-1), // Started yesterday
        saleEndAt: createDate(2), // Ends in 2 days
        depositEndAt: createDate(1), // Deposit deadline tomorrow
        auctionStartAt: createDate(3), // Auction in 3 days
        auctionEndAt: createDate(3, 1), // 1 hour auction
        viewTime: 'Test viewing hours',
        saleFee: 500000,
        depositAmountRequired: 100000000, // 100M VND
        startingPrice: 1000000000, // 1B VND
        bidIncrement: 50000000, // 50M VND
        assetDescription: 'Test asset for integration testing',
        assetAddress: 'Test Address, Integration Test City',
        validCheckInBeforeStartMinutes: 30,
        validCheckInAfterStartMinutes: 15,
        hasMaxBidSteps: false,
        maxBidSteps: 0,
        isActive: true,
      },
    });

    // Add some images and attachments for completeness
    await prismaService.auctionImage.create({
      data: {
        auctionId: testAuction.id,
        url: 'https://test.com/image1.jpg',
        sortOrder: 0,
      },
    });

    await prismaService.auctionAttachment.create({
      data: {
        auctionId: testAuction.id,
        url: 'https://test.com/document.pdf',
        type: 'document',
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Authentication Flow', () => {
    it('should register a new user successfully', async () => {
      const registerData = {
        email: 'newuser@test.com',
        password: 'TestPassword123!',
        full_name: 'New Test User',
        phone_number: '+84987654321',
        identity_number: '987654321098',
        user_type: 'individual' as UserType,
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerData)
        .expect(201);

      expect(response.body).toHaveProperty('user_id');
      expect(response.body).toHaveProperty('email', registerData.email);
      expect(response.body).toHaveProperty('verification_required', true);

      // Verify user was created in database
      const user = await prismaService.user.findUnique({
        where: { email: registerData.email },
      });
      expect(user).toBeTruthy();
      expect(user?.fullName).toBe(registerData.full_name);
    });

    it('should login with existing user credentials', async () => {
      const loginData = {
        email: testUsers.bidder1.email,
        password: 'testpassword',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
      expect(response.body).toHaveProperty('expires_in');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(loginData.email);
    });

    it('should reject login with invalid credentials', async () => {
      const loginData = {
        email: 'nonexistent@test.com',
        password: 'wrongpassword',
      };

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginData)
        .expect(400);
    });
  });

  describe('2. Registration to Bid Flow', () => {
    it('should allow verified user to register for auction', async () => {
      const registrationData = {
        auctionId: testAuction.id,
      };

      const response = await request(app.getHttpServer())
        .post('/register-to-bid')
        .set('Authorization', `Bearer ${authTokens.bidder1}`)
        .send(registrationData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('auctionId', testAuction.id);
      expect(response.body).toHaveProperty('userId', testUsers.bidder1.id);
      expect(response.body).toHaveProperty('registeredAt');

      // Verify in database
      const participant = await prismaService.auctionParticipant.findUnique({
        where: {
          auctionId_userId: {
            auctionId: testAuction.id,
            userId: testUsers.bidder1.id,
          },
        },
      });
      expect(participant).toBeTruthy();
    });

    it('should reject registration without authentication', async () => {
      const registrationData = {
        auctionId: testAuction.id,
      };

      await request(app.getHttpServer())
        .post('/register-to-bid')
        .send(registrationData)
        .expect(401);
    });

    it('should reject duplicate registration for same auction', async () => {
      // First registration
      await request(app.getHttpServer())
        .post('/register-to-bid')
        .set('Authorization', `Bearer ${authTokens.bidder1}`)
        .send({ auctionId: testAuction.id })
        .expect(201);

      // Duplicate registration should fail
      await request(app.getHttpServer())
        .post('/register-to-bid')
        .set('Authorization', `Bearer ${authTokens.bidder1}`)
        .send({ auctionId: testAuction.id })
        .expect(409);
    });

    it('should allow user to withdraw registration', async () => {
      // First register
      await request(app.getHttpServer())
        .post('/register-to-bid')
        .set('Authorization', `Bearer ${authTokens.bidder1}`)
        .send({ auctionId: testAuction.id })
        .expect(201);

      // Then withdraw
      const response = await request(app.getHttpServer())
        .post('/register-to-bid/withdraw')
        .set('Authorization', `Bearer ${authTokens.bidder1}`)
        .send({
          auctionId: testAuction.id,
          withdrawalReason: 'Changed my mind',
        })
        .expect(200);

      expect(response.body).toHaveProperty('withdrawnAt');
      expect(response.body).toHaveProperty(
        'withdrawalReason',
        'Changed my mind'
      );

      // Verify in database
      const participant = await prismaService.auctionParticipant.findUnique({
        where: {
          auctionId_userId: {
            auctionId: testAuction.id,
            userId: testUsers.bidder1.id,
          },
        },
      });
      expect(participant!.withdrawnAt).toBeTruthy();
    });

    it('should show user registrations for admin', async () => {
      // Register user for auction
      await request(app.getHttpServer())
        .post('/register-to-bid')
        .set('Authorization', `Bearer ${authTokens.bidder1}`)
        .send({ auctionId: testAuction.id })
        .expect(201);

      // Admin should be able to see user registrations
      const response = await request(app.getHttpServer())
        .get(
          `/register-to-bid/admin/users/${testUsers.bidder1.id}/registrations`
        )
        .set('Authorization', `Bearer ${authTokens.admin}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0]).toHaveProperty('auctionId', testAuction.id);
      expect(response.body[0]).toHaveProperty('userId', testUsers.bidder1.id);
    });
  });

  describe('3. Manual Bidding Flow', () => {
    interface ParticipantWithUser {
      id: string;
      userId: string;
      auctionId: string;
      user: User;
      registeredAt: Date;
      submittedAt: Date;
      confirmedAt: Date;
    }

    let participants: Array<ParticipantWithUser>;

    beforeEach(async () => {
      // Set up auction as live and create participants
      await prismaService.auction.update({
        where: { id: testAuction.id },
        data: {
          status: AuctionStatus.live,
          auctionStartAt: createDate(0, -1), // Started 1 hour ago
          auctionEndAt: createDate(0, 1), // Ends in 1 hour
        },
      });

      // Register and confirm multiple bidders
      participants = [];
      for (const user of [
        testUsers.bidder1,
        testUsers.bidder2,
        testUsers.bidder3,
      ]) {
        const participant = await prismaService.auctionParticipant.create({
          data: {
            userId: user.id,
            auctionId: testAuction.id,
            registeredAt: createDate(-2),
            submittedAt: createDate(-2, 1),
            confirmedAt: createDate(-1),
            checkedInAt: createDate(0, -1), // Checked in when auction started
          },
        });
        participants.push({ ...participant, user });
      }
    });

    it('should allow confirmed participant to place bid', async () => {
      const bidData = {
        auctionId: testAuction.id,
        amount: 1000000000, // Starting price
      };

      const response = await request(app.getHttpServer())
        .post('/manual-bid')
        .set('Authorization', `Bearer ${authTokens.bidder1}`)
        .send(bidData)
        .expect(201);

      expect(response.body).toHaveProperty('bidId');
      expect(response.body).toHaveProperty('amount', bidData.amount.toString());
      expect(response.body).toHaveProperty('bidType', 'manual');
      expect(response.body).toHaveProperty('isWinningBid', true);

      // Verify in database
      const bid = await prismaService.auctionBid.findFirst({
        where: {
          auctionId: testAuction.id,
          participantId: participants[0].id,
        },
      });
      expect(bid).toBeTruthy();
      expect(bid!.amount.toString()).toBe(bidData.amount.toString());
    });

    it('should enforce bid increment rules', async () => {
      // Place first bid at starting price
      await request(app.getHttpServer())
        .post('/manual-bid')
        .set('Authorization', `Bearer ${authTokens.bidder1}`)
        .send({
          auctionId: testAuction.id,
          amount: 1000000000,
        })
        .expect(201);

      // Try to place bid with insufficient increment (should fail)
      await request(app.getHttpServer())
        .post('/manual-bid')
        .set('Authorization', `Bearer ${authTokens.bidder2}`)
        .send({
          auctionId: testAuction.id,
          amount: 1010000000, // Less than 50M increment
        })
        .expect(400);

      // Place bid with proper increment (should succeed)
      const response = await request(app.getHttpServer())
        .post('/manual-bid')
        .set('Authorization', `Bearer ${authTokens.bidder2}`)
        .send({
          auctionId: testAuction.id,
          amount: 1050000000, // Proper 50M increment
        })
        .expect(201);

      expect(response.body).toHaveProperty('isWinningBid', true);

      // Verify previous bid is no longer winning
      const previousBid = await prismaService.auctionBid.findFirst({
        where: {
          auctionId: testAuction.id,
          participantId: participants[0].id,
        },
      });
      expect(previousBid!.isWinningBid).toBe(false);
    });

    it('should create bidding sequence with multiple participants', async () => {
      const bidSequence = [
        { bidder: authTokens.bidder1, amount: 1000000000 }, // Starting
        { bidder: authTokens.bidder2, amount: 1050000000 }, // +50M
        { bidder: authTokens.bidder3, amount: 1100000000 }, // +50M
        { bidder: authTokens.bidder1, amount: 1150000000 }, // +50M
        { bidder: authTokens.bidder2, amount: 1200000000 }, // +50M (final)
      ];

      for (let i = 0; i < bidSequence.length; i++) {
        const { bidder, amount } = bidSequence[i];

        const response = await request(app.getHttpServer())
          .post('/manual-bid')
          .set('Authorization', `Bearer ${bidder}`)
          .send({
            auctionId: testAuction.id,
            amount,
          })
          .expect(201);

        expect(response.body).toHaveProperty('amount', amount.toString());
        expect(response.body).toHaveProperty('isWinningBid', true);

        // Small delay between bids to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // Verify final state
      const allBids = await prismaService.auctionBid.findMany({
        where: { auctionId: testAuction.id },
        orderBy: { bidAt: 'asc' },
      });

      expect(allBids).toHaveLength(bidSequence.length);

      // Only the last bid should be winning
      const winningBids = allBids.filter((bid) => bid.isWinningBid);
      expect(winningBids).toHaveLength(1);
      expect(winningBids[0].amount.toString()).toBe('1200000000');
    });

    it('should reject bids from unregistered users', async () => {
      await request(app.getHttpServer())
        .post('/manual-bid')
        .set('Authorization', `Bearer ${authTokens.auctioneer}`) // Auctioneer not registered
        .send({
          auctionId: testAuction.id,
          amount: 1000000000,
        })
        .expect(403);
    });

    it('should allow admin to deny a bid', async () => {
      // Place a bid first
      const bidResponse = await request(app.getHttpServer())
        .post('/manual-bid')
        .set('Authorization', `Bearer ${authTokens.bidder1}`)
        .send({
          auctionId: testAuction.id,
          amount: 1000000000,
        })
        .expect(201);

      const bidId = bidResponse.body.bidId;

      // Admin denies the bid
      const denyResponse = await request(app.getHttpServer())
        .post('/manual-bid/deny')
        .set('Authorization', `Bearer ${authTokens.admin}`)
        .send({
          bidId: bidId,
          reason: 'Fraudulent activity detected',
        })
        .expect(201);

      expect(denyResponse.body).toHaveProperty('isDenied', true);
      expect(denyResponse.body).toHaveProperty(
        'deniedReason',
        'Fraudulent activity detected'
      );
      expect(denyResponse.body).toHaveProperty('isWinningBid', false);

      // Verify in database
      const deniedBid = await prismaService.auctionBid.findUnique({
        where: { id: bidId },
      });
      expect(deniedBid!.isDenied).toBe(true);
      expect(deniedBid!.isWinningBid).toBe(false);
    });
  });

  describe('4. Auction Finalization Flow', () => {
    let winningBid: any;
    let participants: any[];

    beforeEach(async () => {
      // Set up completed auction with bids
      await prismaService.auction.update({
        where: { id: testAuction.id },
        data: {
          status: AuctionStatus.live,
          auctionStartAt: createDate(-1), // Started yesterday
          auctionEndAt: createDate(0, -1), // Ended 1 hour ago
        },
      });

      // Create participants
      participants = [];
      for (const user of [
        testUsers.bidder1,
        testUsers.bidder2,
        testUsers.bidder3,
      ]) {
        const participant = await prismaService.auctionParticipant.create({
          data: {
            userId: user.id,
            auctionId: testAuction.id,
            registeredAt: createDate(-3),
            submittedAt: createDate(-3, 1),
            confirmedAt: createDate(-2),
            checkedInAt: createDate(-1, -1),
          },
        });
        participants.push(participant);
      }

      // Create bidding sequence with winner
      const bids = [
        { participantId: participants[0].id, amount: 1000000000 },
        { participantId: participants[1].id, amount: 1050000000 },
        { participantId: participants[2].id, amount: 1100000000 },
        { participantId: participants[0].id, amount: 1150000000 },
        { participantId: participants[1].id, amount: 1200000000 }, // Winner
      ];

      for (let i = 0; i < bids.length; i++) {
        const bid = await prismaService.auctionBid.create({
          data: {
            auctionId: testAuction.id,
            participantId: bids[i].participantId,
            amount: bids[i].amount,
            bidAt: createDate(-1, 0, -60 + i * 10), // Spread over time
            bidType: 'manual',
            isWinningBid: i === bids.length - 1, // Last bid wins
          },
        });

        if (i === bids.length - 1) {
          winningBid = bid;
        }
      }
    });

    it('should evaluate auction status correctly', async () => {
      const response = await request(app.getHttpServer())
        .get(`/auction-finalization/evaluate/${testAuction.id}`)
        .set('Authorization', `Bearer ${authTokens.admin}`)
        .expect(200);

      expect(response.body).toHaveProperty('currentStatus', 'live');
      expect(response.body).toHaveProperty('recommendedStatus', 'success');
      expect(response.body).toHaveProperty('hasWinner', true);
      expect(response.body).toHaveProperty('totalBids', 5);
      expect(response.body).toHaveProperty('winningAmount', '1200000000');
      expect(response.body.winner).toHaveProperty(
        'userId',
        testUsers.bidder2.id
      );
    });

    it('should finalize auction successfully and send emails', async () => {
      const finalizeData = {
        auctionId: testAuction.id,
        sendNotifications: true,
      };

      const response = await request(app.getHttpServer())
        .post('/auction-finalization/finalize')
        .set('Authorization', `Bearer ${authTokens.auctioneer}`)
        .send(finalizeData)
        .expect(201);

      expect(response.body).toHaveProperty('auctionId', testAuction.id);
      expect(response.body).toHaveProperty('finalStatus', 'success');
      expect(response.body).toHaveProperty('winner');
      expect(response.body).toHaveProperty('contract');
      expect(response.body).toHaveProperty('emailsSent', true);

      // Verify auction status updated
      const updatedAuction = await prismaService.auction.findUnique({
        where: { id: testAuction.id },
      });
      expect(updatedAuction!.status).toBe(AuctionStatus.success);

      // Verify contract created
      const contract = await prismaService.contract.findFirst({
        where: { auctionId: testAuction.id },
      });
      expect(contract).toBeTruthy();
      expect(contract!.buyerUserId).toBe(testUsers.bidder2.id);
      expect(contract!.sellerUserId).toBe(testUsers.auctioneer.id);
      expect(contract!.price.toString()).toBe('1200000000');

      // Verify audit log created
      const auditLog = await prismaService.auctionAuditLog.findFirst({
        where: {
          auctionId: testAuction.id,
          action: 'AUCTION_FINALIZED',
        },
      });
      expect(auditLog).toBeTruthy();

      // Verify emails were triggered
      expect(emailService.sendBulkAuctionResultEmails).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            recipientEmail: testUsers.bidder1.email,
            isWinner: false,
          }),
          expect.objectContaining({
            recipientEmail: testUsers.bidder2.email,
            isWinner: true,
            winningAmount: '1200000000',
          }),
          expect.objectContaining({
            recipientEmail: testUsers.bidder3.email,
            isWinner: false,
          }),
        ])
      );
    });

    it('should get auction results after finalization', async () => {
      // First finalize the auction
      await request(app.getHttpServer())
        .post('/auction-finalization/finalize')
        .set('Authorization', `Bearer ${authTokens.auctioneer}`)
        .send({ auctionId: testAuction.id })
        .expect(201);

      // Then get results
      const response = await request(app.getHttpServer())
        .get(`/auction-finalization/results/${testAuction.id}`)
        .set('Authorization', `Bearer ${authTokens.bidder1}`)
        .expect(200);

      expect(response.body).toHaveProperty('auction');
      expect(response.body).toHaveProperty('winner');
      expect(response.body).toHaveProperty('allBids');
      expect(response.body).toHaveProperty('userBids');
      expect(response.body).toHaveProperty('contract');

      expect(response.body.winner).toHaveProperty(
        'userId',
        testUsers.bidder2.id
      );
      expect(response.body.allBids).toHaveLength(5);
      expect(response.body.contract).toHaveProperty('status', 'draft');
    });

    it('should allow admin to override auction status', async () => {
      const overrideData = {
        auctionId: testAuction.id,
        newStatus: 'cancelled' as AuctionStatus,
        reason: 'Fraud detected during investigation',
      };

      const response = await request(app.getHttpServer())
        .post('/auction-finalization/override')
        .set('Authorization', `Bearer ${authTokens.admin}`)
        .send(overrideData)
        .expect(200);

      expect(response.body).toHaveProperty('auctionId', testAuction.id);
      expect(response.body).toHaveProperty('previousStatus', 'live');
      expect(response.body).toHaveProperty('newStatus', 'cancelled');
      expect(response.body).toHaveProperty('reason', overrideData.reason);

      // Verify auction status updated
      const updatedAuction = await prismaService.auction.findUnique({
        where: { id: testAuction.id },
      });
      expect(updatedAuction!.status).toBe(AuctionStatus.cancelled);

      // Verify audit log created
      const auditLog = await prismaService.auctionAuditLog.findFirst({
        where: {
          auctionId: testAuction.id,
          action: 'STATUS_OVERRIDE',
        },
      });
      expect(auditLog).toBeTruthy();
      expect(auditLog!.reason).toBe(overrideData.reason);
    });

    it('should get audit logs for auction owner', async () => {
      // Create some audit logs by performing actions
      await request(app.getHttpServer())
        .post('/auction-finalization/finalize')
        .set('Authorization', `Bearer ${authTokens.auctioneer}`)
        .send({ auctionId: testAuction.id })
        .expect(201);

      // Auction owner should be able to see audit logs
      const response = await request(app.getHttpServer())
        .get(`/auction-finalization/audit-logs/${testAuction.id}`)
        .set('Authorization', `Bearer ${authTokens.auctioneer}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      const finalizationLog = response.body.find(
        (log: any) => log.action === 'AUCTION_FINALIZED'
      );
      expect(finalizationLog).toBeTruthy();
      expect(finalizationLog).toHaveProperty('performedBy', testUsers.admin.id);
    });

    it('should handle auction with no bids (no_bid status)', async () => {
      // Create auction with no bids
      const noBidAuction = await prismaService.auction.create({
        data: {
          code: 'NOBID001',
          name: 'No Bid Auction',
          propertyOwner: testUsers.auctioneer.id,
          assetType: 'other_asset',
          status: AuctionStatus.live,
          saleStartAt: createDate(-2),
          saleEndAt: createDate(-1),
          depositEndAt: createDate(-1),
          auctionStartAt: createDate(-1),
          auctionEndAt: createDate(0, -2), // Ended 2 hours ago
          viewTime: 'No bid test',
          saleFee: 100000,
          depositAmountRequired: 50000000,
          startingPrice: 500000000,
          bidIncrement: 25000000,
          assetDescription: 'No bid test asset',
          assetAddress: 'No bid test address',
          validCheckInBeforeStartMinutes: 30,
          validCheckInAfterStartMinutes: 15,
          hasMaxBidSteps: false,
          maxBidSteps: 0,
          isActive: true,
        },
      });

      // Evaluate auction (should recommend no_bid status)
      const evaluateResponse = await request(app.getHttpServer())
        .get(`/auction-finalization/evaluate/${noBidAuction.id}`)
        .set('Authorization', `Bearer ${authTokens.admin}`)
        .expect(200);

      expect(evaluateResponse.body).toHaveProperty(
        'recommendedStatus',
        'no_bid'
      );
      expect(evaluateResponse.body).toHaveProperty('hasWinner', false);
      expect(evaluateResponse.body).toHaveProperty('totalBids', 0);

      // Finalize auction
      const finalizeResponse = await request(app.getHttpServer())
        .post('/auction-finalization/finalize')
        .set('Authorization', `Bearer ${authTokens.auctioneer}`)
        .send({ auctionId: noBidAuction.id })
        .expect(201);

      expect(finalizeResponse.body).toHaveProperty('finalStatus', 'no_bid');
      expect(finalizeResponse.body).toHaveProperty('winner', null);
      expect(finalizeResponse.body).toHaveProperty('contract', null);

      // Verify auction status
      const updatedAuction = await prismaService.auction.findUnique({
        where: { id: noBidAuction.id },
      });
      expect(updatedAuction!.status).toBe(AuctionStatus.no_bid);
    });
  });

  describe('5. Email Notification System', () => {
    beforeEach(async () => {
      // Set up auction with participants for email testing
      await prismaService.auction.update({
        where: { id: testAuction.id },
        data: { status: AuctionStatus.success },
      });

      // Create participants with bids
      const participant1 = await prismaService.auctionParticipant.create({
        data: {
          userId: testUsers.bidder1.id,
          auctionId: testAuction.id,
          registeredAt: createDate(-2),
          confirmedAt: createDate(-1),
        },
      });

      const participant2 = await prismaService.auctionParticipant.create({
        data: {
          userId: testUsers.bidder2.id,
          auctionId: testAuction.id,
          registeredAt: createDate(-2),
          confirmedAt: createDate(-1),
        },
      });

      // Create winning bid
      await prismaService.auctionBid.create({
        data: {
          auctionId: testAuction.id,
          participantId: participant2.id,
          amount: 1200000000,
          bidAt: createDate(-1),
          bidType: 'manual',
          isWinningBid: true,
        },
      });

      // Create losing bid
      await prismaService.auctionBid.create({
        data: {
          auctionId: testAuction.id,
          participantId: participant1.id,
          amount: 1100000000,
          bidAt: createDate(-1, 0, -10),
          bidType: 'manual',
          isWinningBid: false,
        },
      });
    });

    it('should generate proper email data for finalization', async () => {
      const response = await request(app.getHttpServer())
        .post('/auction-finalization/finalize')
        .set('Authorization', `Bearer ${authTokens.auctioneer}`)
        .send({
          auctionId: testAuction.id,
          sendNotifications: true,
        })
        .expect(201);

      expect(response.body).toHaveProperty('emailsSent', true);

      // Verify email service was called with correct data
      expect(emailService.sendBulkAuctionResultEmails).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            recipientEmail: testUsers.bidder1.email,
            recipientName: testUsers.bidder1.fullName,
            auctionCode: testAuction.code,
            auctionName: testAuction.name,
            isWinner: false,
            winnerName: testUsers.bidder2.fullName,
            winningAmount: '1200000000',
            totalBids: 2,
          }),
          expect.objectContaining({
            recipientEmail: testUsers.bidder2.email,
            recipientName: testUsers.bidder2.fullName,
            auctionCode: testAuction.code,
            auctionName: testAuction.name,
            isWinner: true,
            winningAmount: '1200000000',
            totalBids: 2,
          }),
        ])
      );
    });

    it('should handle email sending failures gracefully', async () => {
      // Mock email service to throw error
      jest
        .spyOn(emailService, 'sendBulkAuctionResultEmails')
        .mockRejectedValueOnce(new Error('SMTP connection failed'));

      // Finalization should still succeed even if emails fail
      const response = await request(app.getHttpServer())
        .post('/auction-finalization/finalize')
        .set('Authorization', `Bearer ${authTokens.auctioneer}`)
        .send({
          auctionId: testAuction.id,
          sendNotifications: true,
        })
        .expect(201);

      expect(response.body).toHaveProperty('finalStatus', 'success');
      expect(response.body).toHaveProperty('emailsSent', false);

      // Auction should still be finalized even with email failure
      const auction = await prismaService.auction.findUnique({
        where: { id: testAuction.id },
      });
      expect(auction!.status).toBe(AuctionStatus.success);
    });
  });

  describe('6. Edge Cases and Error Handling', () => {
    it('should handle expired JWT tokens', async () => {
      const expiredPayload = {
        sub: testUsers.bidder1.id,
        email: testUsers.bidder1.email,
        iat: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        exp: Math.floor(Date.now() / 1000) - 1800, // Expired 30 minutes ago
      };

      const expiredToken = jwt.sign(expiredPayload, process.env.JWT_SECRET!, {
        algorithm: 'HS256',
      });

      await request(app.getHttpServer())
        .post('/register-to-bid')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({ auctionId: testAuction.id })
        .expect(401);
    });

    it('should handle invalid JWT tokens', async () => {
      const invalidToken = 'invalid.jwt.token';

      await request(app.getHttpServer())
        .post('/register-to-bid')
        .set('Authorization', `Bearer ${invalidToken}`)
        .send({ auctionId: testAuction.id })
        .expect(401);
    });

    it('should handle non-existent auction IDs', async () => {
      const fakeAuctionId = '00000000-0000-0000-0000-000000000000';

      await request(app.getHttpServer())
        .post('/register-to-bid')
        .set('Authorization', `Bearer ${authTokens.bidder1}`)
        .send({ auctionId: fakeAuctionId })
        .expect(404);
    });

    it('should handle concurrent bid submissions', async () => {
      // Set up live auction with participants
      await prismaService.auction.update({
        where: { id: testAuction.id },
        data: {
          status: AuctionStatus.live,
          auctionStartAt: createDate(0, -1),
          auctionEndAt: createDate(0, 1),
        },
      });

      const participant1 = await prismaService.auctionParticipant.create({
        data: {
          userId: testUsers.bidder1.id,
          auctionId: testAuction.id,
          registeredAt: createDate(-1),
          confirmedAt: createDate(-1),
          checkedInAt: createDate(0, -1),
        },
      });

      const participant2 = await prismaService.auctionParticipant.create({
        data: {
          userId: testUsers.bidder2.id,
          auctionId: testAuction.id,
          registeredAt: createDate(-1),
          confirmedAt: createDate(-1),
          checkedInAt: createDate(0, -1),
        },
      });

      // Submit concurrent bids with same amount (should handle race condition)
      const bidPromises = [
        request(app.getHttpServer())
          .post('/manual-bid')
          .set('Authorization', `Bearer ${authTokens.bidder1}`)
          .send({ auctionId: testAuction.id, amount: 1000000000 }),
        request(app.getHttpServer())
          .post('/manual-bid')
          .set('Authorization', `Bearer ${authTokens.bidder2}`)
          .send({ auctionId: testAuction.id, amount: 1000000000 }),
      ];

      const results = await Promise.allSettled(bidPromises);

      // One should succeed, one should fail (or both succeed with proper handling)
      const successful = results.filter(
        (r) => r.status === 'fulfilled' && (r.value as any).status === 201
      ).length;

      expect(successful).toBeGreaterThanOrEqual(1);
      expect(successful).toBeLessThanOrEqual(2);
    });

    it('should handle malformed request bodies', async () => {
      await request(app.getHttpServer())
        .post('/register-to-bid')
        .set('Authorization', `Bearer ${authTokens.bidder1}`)
        .send({ invalidField: 'invalid data' })
        .expect(400);
    });

    it('should enforce auction time boundaries for bidding', async () => {
      // Set auction as not yet started
      await prismaService.auction.update({
        where: { id: testAuction.id },
        data: {
          auctionStartAt: createDate(1), // Starts tomorrow
          auctionEndAt: createDate(1, 1),
        },
      });

      const participant = await prismaService.auctionParticipant.create({
        data: {
          userId: testUsers.bidder1.id,
          auctionId: testAuction.id,
          registeredAt: createDate(-1),
          confirmedAt: createDate(-1),
        },
      });

      // Should not allow bidding before auction starts
      await request(app.getHttpServer())
        .post('/manual-bid')
        .set('Authorization', `Bearer ${authTokens.bidder1}`)
        .send({ auctionId: testAuction.id, amount: 1000000000 })
        .expect(400);
    });
  });
});
