
import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  Get,
  Param,
} from '@nestjs/common';
import { RegisterToBidService, } from './register-to-bid.service';
import { CreateRegisterToBidDto } from './dto/create-register-to-bid.dto';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import {RegisterToBid, User} from '@prisma/client';

@Controller('register-to-bid')
export class RegisterToBidController {
  constructor(private readonly svc: RegisterToBidService) {}

  @Post()
  @UseGuards(AuthGuard)
  @HttpCode(201)
  create(@Body() dto: CreateRegisterToBidDto, @CurrentUser() user: User) {
    return this.svc.create(dto, user);
  }

  @Get('admin/users/:userId/registrations')
  @UseGuards(AuthGuard /*, RolesGuard('admin') or a policy guard */)
  listForUser(@Param('userId') userId: string) {
    return this.svc.getRegistrationStatusForAdmin(userId);
  }
}

