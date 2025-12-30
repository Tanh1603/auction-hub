import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ContractService } from './contract.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ContractQueryDto } from './dto/contract-query.dto';
import { SignContractDto } from './dto/sign-contract.dto';
import { CancelContractDto } from './dto/cancel-contract.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { ContractAccessGuard } from './guards/contract-access.guard';
import {
  CurrentUser,
  CurrentUserData,
} from '../common/decorators/current-user.decorator';

@Controller('contracts')
@UseGuards(AuthGuard)
export class ContractController {
  constructor(private readonly contractService: ContractService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() query: ContractQueryDto,
    @CurrentUser() user: CurrentUserData
  ) {
    const result = await this.contractService.findAll(
      query,
      user.id,
      user.role
    );
    return {
      message: 'Contracts retrieved successfully',
      ...result,
    };
  }

  @Get(':id')
  @UseGuards(ContractAccessGuard)
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    const contract = await this.contractService.findOne(id, user.id, user.role);
    return {
      message: 'Contract retrieved successfully',
      data: contract,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createContractDto: CreateContractDto,
    @CurrentUser() user: CurrentUserData
  ) {
    return this.contractService.create(createContractDto, user.id);
  }

  @Patch(':id')
  @UseGuards(ContractAccessGuard)
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() updateContractDto: UpdateContractDto,
    @CurrentUser() user: CurrentUserData
  ) {
    return this.contractService.update(
      id,
      updateContractDto,
      user.id,
      user.role
    );
  }

  @Post(':id/sign')
  @UseGuards(ContractAccessGuard)
  @HttpCode(HttpStatus.OK)
  async sign(
    @Param('id') id: string,
    @Body() signContractDto: SignContractDto,
    @CurrentUser() user: CurrentUserData
  ) {
    return this.contractService.sign(id, signContractDto, user.id, user.role);
  }

  @Post(':id/cancel')
  @UseGuards(ContractAccessGuard)
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('id') id: string,
    @Body() cancelContractDto: CancelContractDto,
    @CurrentUser() user: CurrentUserData
  ) {
    return this.contractService.cancel(
      id,
      cancelContractDto,
      user.id,
      user.role
    );
  }

  @Get(':id/pdf/vi')
  @UseGuards(ContractAccessGuard)
  @HttpCode(HttpStatus.OK)
  async exportToPdf(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Res() res: Response
  ) {
    const pdfDoc = await this.contractService.exportToPdf(
      id,
      user.id,
      user.role
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=contract-${id}-${Date.now()}.pdf`
    );

    pdfDoc.pipe(res);
    pdfDoc.end();
  }

  @Get(':id/pdf/en')
  @UseGuards(ContractAccessGuard)
  @HttpCode(HttpStatus.OK)
  async exportToPdfEnglish(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Res() res: Response
  ) {
    const pdfDoc = await this.contractService.exportToPdfEnglish(
      id,
      user.id,
      user.role
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=contract-${id}-en-${Date.now()}.pdf`
    );

    pdfDoc.pipe(res);
    pdfDoc.end();
  }
}
