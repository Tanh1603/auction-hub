import { Module, Global } from '@nestjs/common';
import { SystemVariablesService } from './services/system-variables.service';
import { EmailModule } from './email/email.module';
import { EmailTestController } from './controllers/email-test.controller';
import { SystemVariablesController } from './controllers/system-variables.controller';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [EmailTestController, SystemVariablesController],
  providers: [SystemVariablesService, AuthGuard, RolesGuard],
  exports: [EmailModule, SystemVariablesService, AuthGuard, RolesGuard],
})
export class CommonModule {}
