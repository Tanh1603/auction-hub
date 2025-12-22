import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { EmailService } from '../services/email.service';
import { EmailTemplateService } from './email-template.service';
import { EmailQueueService } from './email-queue.service';
import { EmailProcessor } from './email.processor';
import { EMAIL_QUEUE } from './email.queue';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: EMAIL_QUEUE,
    }),
  ],
  providers: [
    EmailService,
    EmailTemplateService,
    EmailQueueService,
    EmailProcessor,
  ],
  exports: [EmailService, EmailTemplateService, EmailQueueService],
})
export class EmailModule {}
