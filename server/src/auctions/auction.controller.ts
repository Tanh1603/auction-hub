import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBadRequestResponse, ApiBody, ApiOkResponse } from '@nestjs/swagger';
import { ApiResponse, ApiResponseError } from '../common/dto/reponse.dto';
import { AuctionService } from './auction.service';
import { AuctionDetailDto } from './dto/auction-detail.dto';
import { AuctionQueryDto } from './dto/auction-query.dto';
import { AucitonSummaryDto } from './dto/auction-summary.dto';
import { CreateAuctionDto } from './dto/create-auction.dto';
import {
  UpdateAuctionDto,
  UpdateAuctionRelationsDto,
} from './dto/update-auction.dto';

@Controller('auctions')
export class AuctionController {
  constructor(private readonly auctionService: AuctionService) {}

  // Get all
  @ApiOkResponse({
    type: ApiResponse<AucitonSummaryDto[]>,
  })
  @ApiBadRequestResponse({
    description: 'Bad request',
    type: ApiResponseError,
  })
  @Get()
  async findAll(@Query() query: AuctionQueryDto) {
    return this.auctionService.findAll(query);
  }

  // Get detail
  @ApiOkResponse({
    description: 'List of auctions',
    type: ApiResponse<AuctionDetailDto>,
  })
  @ApiBadRequestResponse({
    description: 'Bad request',
    type: ApiResponseError,
  })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.auctionService.findOne(id);
  }

  // Creat auction
  @ApiOkResponse({
    type: ApiResponse<AuctionDetailDto>,
  })
  @ApiBadRequestResponse({
    description: 'Bad request',
    type: ApiResponseError,
  })
  @ApiBody({
    type: CreateAuctionDto,
  })
  @Post()
  create(@Body() request: CreateAuctionDto) {
    return this.auctionService.create(request);
  }

  @ApiOkResponse({
    type: ApiResponse<AuctionDetailDto>,
  })
  @ApiBadRequestResponse({
    description: 'Bad request',
    type: ApiResponseError,
  })
  @ApiBody({
    type: UpdateAuctionDto,
  })
  @Put(':id')
  update(@Param('id') id: string, @Body() request: UpdateAuctionDto) {
    return this.auctionService.update(id, request);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.auctionService.remove(id);
  }

  @Patch(':id/relations')
  @ApiOkResponse({
    description: 'List of auctions',
    type: ApiResponse<AuctionDetailDto>,
  })
  @ApiBadRequestResponse({
    description: 'Bad request',
    type: ApiResponseError,
  })
  @ApiBody({
    type: UpdateAuctionRelationsDto,
  })
  async updateRelation(
    @Param('id') id: string,
    @Body() request: UpdateAuctionRelationsDto
  ) {
    return this.auctionService.updateRelations(id, request.relatedIds);
  }
}
