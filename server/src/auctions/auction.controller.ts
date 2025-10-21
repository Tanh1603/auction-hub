import { Controller, Get, Param, Query } from '@nestjs/common';
import { AuctionService } from './auction.service';
import { AuctionQueryDto } from './dto/auction-query.dto';

@Controller('auctions')
export class AuctionController {
  constructor(private readonly auctionService: AuctionService) {}

  @Get()
  async findAll(@Query() query: AuctionQueryDto) {
    console.log(query);

    return this.auctionService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.auctionService.findOne(id);
  }
}
