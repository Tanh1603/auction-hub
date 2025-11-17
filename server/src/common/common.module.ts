import { Module, Global } from '@nestjs/common';
import { EmailService } from './services/email.service';
import { EmailTestController } from './controllers/email-test.controller';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [EmailTestController],
  providers: [EmailService, AuthGuard, RolesGuard],
  exports: [EmailService, AuthGuard, RolesGuard],
})
export class CommonModule {}
