import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ApiResponse, ApiResponseError } from '../common/dto/reponse.dto';
import { AuctionService } from './auction.service';
import { AuctionDetailDto } from './dto/auction-detail.dto';
import { AuctionQueryDto } from './dto/auction-query.dto';
import { AucitonSummaryDto } from './dto/auction-summary.dto';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { FileUploadDto } from './dto/file-upload.dto';
import { UpdateAuctionDto } from './dto/update-auction.dto';

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
    description: 'List of auctions',
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
    description: 'List of auctions',
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

  // Update resources
  @ApiOkResponse({
    description: 'List of auctions',
    type: ApiResponse<AuctionDetailDto>,
  })
  @ApiBadRequestResponse({
    description: 'Bad request',
    type: ApiResponseError,
  })
  @Patch(':id/resources')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'images', maxCount: 10 },
        { name: 'attachments', maxCount: 10 },
      ],
      {
        limits: {
          fileSize: 10 * 1024 * 1024,
        },
      }
    )
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'List of cats',
    type: FileUploadDto,
  })
  async updateResource(
    @UploadedFiles()
    files: {
      images?: Express.Multer.File[];
      attachments?: Express.Multer.File[];
    },
    @Param('id') id: string
  ) {
    return this.auctionService.updateResource(
      id,
      files.images,
      files.attachments
    );
  }
}
