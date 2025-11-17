import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AuctionPolicyService } from './auction-policy.service';
import { PolicyCalculationService } from './policy-calculation.service';
import {
  CreateAuctionPolicyDto,
  AssetOwnershipDto,
} from './dto/create-auction-policy.dto';
import { UpdateAuctionPolicyDto } from './dto/update-auction-policy.dto';
import {
  ValidateDossierFeeDto,
  ValidateDepositPercentageDto,
  CalculateCommissionDto,
  CalculateDepositDto,
} from './dto/validate-fees.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/roles.enum';

@ApiTags('Auction Policy')
@Controller('auction-policy')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class AuctionPolicyController {
  constructor(
    private readonly policyService: AuctionPolicyService,
    private readonly policyCalc: PolicyCalculationService
  ) {}

  /**
   * CREATE: New Auction Policy (Admin only)
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new auction policy' })
  @ApiResponse({ status: 201, description: 'Policy created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  create(@Body() createDto: CreateAuctionPolicyDto) {
    return this.policyService.create(createDto);
  }

  /**
   * READ: Get all policies with optional filters
   */
  @Get()
  @ApiOperation({ summary: 'Get all auction policies' })
  @ApiQuery({
    name: 'assetOwnership',
    required: false,
    enum: AssetOwnershipDto,
  })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'isDefault', required: false, type: Boolean })
  @ApiResponse({
    status: 200,
    description: 'List of policies retrieved successfully',
  })
  findAll(
    @Query('assetOwnership') assetOwnership?: AssetOwnershipDto,
    @Query('isActive') isActive?: string,
    @Query('isDefault') isDefault?: string
  ) {
    const filters: any = {};

    if (assetOwnership) {
      filters.assetOwnership = assetOwnership;
    }

    if (isActive !== undefined) {
      filters.isActive = isActive === 'true';
    }

    if (isDefault !== undefined) {
      filters.isDefault = isDefault === 'true';
    }

    return this.policyService.findAll(filters);
  }

  /**
   * READ: Get default policy for asset ownership type
   */
  @Get('default/:assetOwnership')
  @ApiOperation({ summary: 'Get default policy for asset ownership type' })
  @ApiResponse({
    status: 200,
    description: 'Default policy retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'No default policy found' })
  findDefault(@Param('assetOwnership') assetOwnership: AssetOwnershipDto) {
    return this.policyService.findDefault(assetOwnership);
  }

  /**
   * READ: Get single policy by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a specific auction policy by ID' })
  @ApiResponse({ status: 200, description: 'Policy retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  findOne(@Param('id') id: string) {
    return this.policyService.findOne(id);
  }

  /**
   * UPDATE: Modify existing policy (Admin only)
   */
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update an existing auction policy' })
  @ApiResponse({ status: 200, description: 'Policy updated successfully' })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  update(@Param('id') id: string, @Body() updateDto: UpdateAuctionPolicyDto) {
    return this.policyService.update(id, updateDto);
  }

  /**
   * DELETE: Remove policy (Admin only)
   * Only allowed if no auctions are using it
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an auction policy' })
  @ApiResponse({ status: 204, description: 'Policy deleted successfully' })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  @ApiResponse({ status: 409, description: 'Cannot delete - policy in use' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  remove(@Param('id') id: string) {
    return this.policyService.remove(id);
  }

  /**
   * VALIDATION: Validate Dossier Fee
   */
  @Post('validate/dossier-fee')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate dossier fee against policy limits' })
  @ApiResponse({ status: 200, description: 'Validation result returned' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  validateDossierFee(@Body() dto: ValidateDossierFeeDto) {
    return this.policyCalc.validateDossierFee(
      dto.dossierFee,
      dto.startingPrice
    );
  }

  /**
   * VALIDATION: Validate Deposit Percentage
   */
  @Post('validate/deposit-percentage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate deposit percentage against policy rules' })
  @ApiResponse({ status: 200, description: 'Validation result returned' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  validateDepositPercentage(@Body() dto: ValidateDepositPercentageDto) {
    return this.policyCalc.validateDepositPercentage(
      dto.percentage,
      dto.assetCategory
    );
  }

  /**
   * CALCULATION: Calculate Commission Fee
   */
  @Post('calculate/commission')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calculate commission fee based on final sale price',
  })
  @ApiResponse({
    status: 200,
    description: 'Commission calculated successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  calculateCommission(@Body() dto: CalculateCommissionDto) {
    const commissionFee = this.policyCalc.calculateCommission(
      dto.finalPrice,
      dto.assetCategory
    );

    return {
      finalPrice: dto.finalPrice,
      assetCategory: dto.assetCategory,
      commissionFee,
      calculation: {
        min: 1_000_000,
        max: 400_000_000,
        appliedFee: commissionFee,
      },
    };
  }

  /**
   * CALCULATION: Calculate Deposit Amount
   */
  @Post('calculate/deposit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calculate deposit amount based on policy type and parameters',
  })
  @ApiResponse({ status: 200, description: 'Deposit calculated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  calculateDeposit(@Body() dto: CalculateDepositDto) {
    // Validate configuration
    const validation = this.policyCalc.validateDepositConfig(
      dto.depositType,
      dto.assetCategory,
      dto.percentage,
      dto.fixedAmount
    );

    if (!validation.valid) {
      return {
        valid: false,
        message: validation.message,
      };
    }

    // Calculate deposit amount
    const depositAmount = this.policyCalc.calculateDepositAmount(
      dto.depositType,
      dto.startingPrice,
      dto.percentage,
      dto.fixedAmount
    );

    return {
      valid: true,
      depositType: dto.depositType,
      startingPrice: dto.startingPrice,
      ...(dto.depositType === 'percentage' && {
        percentage: dto.percentage,
        assetCategory: dto.assetCategory,
      }),
      ...(dto.depositType === 'fixed' && {
        fixedAmount: dto.fixedAmount,
      }),
      depositAmount,
    };
  }
}
