import { Injectable, UnauthorizedException, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { CreateManualBidDto } from './dto/create-manual-bid.dto';
import { UpdateManualBidDto } from './dto/update-manual-bid.dto';
import { User } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { EligibilityStrategyFactory } from '../eligibility/eligibility.factory';


@Injectable()
export class ManualBidService {
  constructor(private readonly prisma: PrismaService) {}
  async create(createManualBidDto: CreateManualBidDto, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const item = await this.prisma.item.findUnique({where: {id: createManualBidDto.itemId}});


    if (!item)
    {
      throw new NotFoundException('Item not found');
    }

    const eligibilityStrategy = EligibilityStrategyFactory.create(item);
    const isEligible = await eligibilityStrategy.isEligible(user, item);

    if (!isEligible) {
      throw new ForbiddenException('You are not eligible to bid on this item.');
    }

    //TODO: the bid amount

    return 'This action adds a new manualBid';
  }

  findAll() {
    return `This action returns all manualBid`;
  }

  findOne(id: number) {
    return `This action returns a #${id} manualBid`;
  }

  update(id: number, updateManualBidDto: UpdateManualBidDto) {
    return `This action updates a #${id} manualBid`;
  }

  remove(id: number) {
    return `This action removes a #${id} manualBid`;
  }
}
