import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ManualBidService } from './manual-bid.service';
import { CreateManualBidDto } from './dto/create-manual-bid.dto';
import { DenyBidDto } from './dto/deny-bid.dto';
import { AuthGuard } from '../../../common/guards/auth.guard';
import {
  CurrentUser,
  CurrentUserData,
} from '../../../common/decorators/current-user.decorator';
import { User } from '../../../../generated';

@Controller('manual-bid')
export class ManualBidController {
  constructor(private readonly manualBidService: ManualBidService) {}

  @Post()
  @UseGuards(AuthGuard)
  async create(
    @Body() dto: CreateManualBidDto,
    @CurrentUser() user: CurrentUserData
  ) {
    return this.manualBidService.create(dto, user.id);
  }

  @Post('deny')
  @UseGuards(AuthGuard)
  async denyBid(
    @Body() dto: DenyBidDto,
    @CurrentUser() user: CurrentUserData
  ) {
    return this.manualBidService.denyBid(dto, user.id);
  }
}
