import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ManualBidService } from './manual-bid.service';
import { CreateManualBidDto } from './dto/create-manual-bid.dto';
import { UpdateManualBidDto } from './dto/update-manual-bid.dto';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { CurrentUser, CurrentUserData } from '../../../common/decorators/current-user.decorator';

@Controller('manual-bid')
export class ManualBidController {
  constructor(private readonly manualBidService: ManualBidService) {}

  @Post()
  @UseGuards(AuthGuard)
  create(@Body() createManualBidDto: CreateManualBidDto, @CurrentUser() user: CurrentUserData) {
    return this.manualBidService.create(createManualBidDto, user.id);
  }

  @Get()
  findAll() {
    return this.manualBidService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.manualBidService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateManualBidDto: UpdateManualBidDto) {
    return this.manualBidService.update(+id, updateManualBidDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.manualBidService.remove(+id);
  }
}
