// typescript
import { Injectable, ConflictException, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateRegisterToBidDto } from './dto/create-register-to-bid.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { BidRegistrationStatus, User } from '@prisma/client';

@Injectable()
export class RegisterToBidService {
  constructor(private readonly prisma: PrismaService) {}
  private readonly logger = new Logger(RegisterToBidService.name);

  async create(dto: CreateRegisterToBidDto, user: User) {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // 1/ verify user existence
        const dbUser = await tx.user.findUnique({ where: { id: user.id } });
        if (!dbUser || (dbUser as any).isDeleted || (dbUser as any).isBanned) {
          this.logger.warn(`Inactive or missing user ${user.id}`);
          throw new ForbiddenException('User is not allowed to register to bid');
        }

        // 2/ validate item existence
        const item = await tx.item.findUnique({ where: { id: dto.itemId } });
        if (!item) throw new NotFoundException('Item not found');
        if (!(item as any).isOpenToRegister) {
          throw new ConflictException('Item is not open for registration');
        }

        // 3/ composite unique single row
        const existing = await tx.registerToBid.findUnique({
          where: { uq_registerToBid_user_item: { userId: user.id, itemId: dto.itemId } },
        });

        if (!existing) {
          const created = await tx.registerToBid.create({
            data: {
              userId: user.id,
              itemId: dto.itemId,
              status: BidRegistrationStatus.PENDING,
              documents: dto.documents,
            },
          });
          this.logger.log(`Registration created u=${user.id} i=${dto.itemId}`);
          return this.toDto(created);
        }

        // 4/ transition state
        if (
          existing.status === BidRegistrationStatus.PENDING ||
          existing.status === BidRegistrationStatus.APPROVED
        ) {
          this.logger.warn(`Duplicate registration attempt u=${user.id} i=${dto.itemId}`);
          throw new ConflictException('Active or pending registration already exist for this item');
        }

        // allow REJECTED to re-apply and update docs
        const updated = await tx.registerToBid.update({
          where: { id: existing.id },
          data: {
            status: BidRegistrationStatus.PENDING,
            documents: dto.documents,
          },
        });

        return this.toDto(updated);
      });

      return result;
    } catch (err) {
      this.logger.error(
        `Registration failed for user ${user.id}, item ${dto.itemId}`,
        (err as Error).stack,
      );
      throw err;
    }
  }

  async getRegistrationStatusForAdmin(userId: string) {
    const regs = await this.prisma.registerToBid.findMany({
      where: { userId },
      include: { item: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    if (!regs.length) throw new NotFoundException('No registration found.');
    return regs.map(this.toDto);
  }

  private toDto = (r: any) => ({
    id: r.id,
    userId: r.userId,
    itemId: r.itemId,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  });
}
