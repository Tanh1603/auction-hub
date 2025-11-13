import { Module, Global } from '@nestjs/common';
import { EmailService } from './services/email.service';
import { EmailTestController } from './controllers/email-test.controller';

@Global()
@Module({
  controllers: [EmailTestController],
  providers: [EmailService],
  exports: [EmailService],
})
export class CommonModule {}
