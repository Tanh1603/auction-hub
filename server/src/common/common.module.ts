import { Module, Global } from '@nestjs/common';
import { EmailService } from './services/email.service';
import { SystemVariablesService } from './services/system-variables.service';
import { EmailTestController } from './controllers/email-test.controller';
import { SystemVariablesController } from './controllers/system-variables.controller';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [EmailTestController, SystemVariablesController],
  providers: [EmailService, SystemVariablesService, AuthGuard, RolesGuard],
  exports: [EmailService, SystemVariablesService, AuthGuard, RolesGuard],
})
export class CommonModule {}
