
import { Module } from '@nestjs/common';
import { RegisterToBidService } from './register-to-bid.service';
import { RegisterToBidController } from './register-to-bid.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RegisterToBidController],
  providers: [RegisterToBidService],
})
export class RegisterToBidModule {}
