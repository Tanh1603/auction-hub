import { Module } from '@nestjs/common';
import { ContractController } from './contract.controller';
import { ContractService } from './contract.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ContractController],
  providers: [ContractService, PdfGeneratorService],
  exports: [ContractService],
})
export class ContractModule {}

