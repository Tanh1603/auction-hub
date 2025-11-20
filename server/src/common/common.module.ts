import { Module, Global } from '@nestjs/common';
import { EmailService } from './services/email.service';
import { SystemVariablesService } from './services/system-variables.service';
import { EmailTemplateService } from './email/email-template.service';
import { EmailTestController } from './controllers/email-test.controller';
import { SystemVariablesController } from './controllers/system-variables.controller';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [EmailTestController, SystemVariablesController],
  providers: [
    EmailService,
    EmailTemplateService,
    SystemVariablesService,
    AuthGuard,
    RolesGuard,
  ],
  exports: [
    EmailService,
    EmailTemplateService,
    SystemVariablesService,
    AuthGuard,
    RolesGuard,
  ],
})
export class CommonModule {}
