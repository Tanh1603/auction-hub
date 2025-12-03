import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from '../services/email.service';
import { EmailTemplateService } from './email-template.service';

@Module({
  imports: [ConfigModule],
  providers: [EmailService, EmailTemplateService],
  exports: [EmailService, EmailTemplateService],
})
export class EmailModule {}
