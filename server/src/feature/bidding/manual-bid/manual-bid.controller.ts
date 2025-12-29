import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ManualBidService } from './manual-bid.service';
import { CreateManualBidDto } from './dto/create-manual-bid.dto';
import { DenyBidDto } from './dto/deny-bid.dto';
import {
  CurrentUser,
  CurrentUserData,
} from '../../../common/decorators/current-user.decorator';

import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/roles.enum';

@Controller('manual-bid')
export class ManualBidController {
  constructor(private readonly manualBidService: ManualBidService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.BIDDER)
  async create(
    @Body() dto: CreateManualBidDto,
    @CurrentUser() user: CurrentUserData
  ) {
    return this.manualBidService.create(dto, user.id);
  }

  @Post('deny')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.AUCTIONEER, UserRole.SUPER_ADMIN)
  async denyBid(@Body() dto: DenyBidDto, @CurrentUser() user: CurrentUserData) {
    return this.manualBidService.denyBid(dto, user.id);
  }
}
