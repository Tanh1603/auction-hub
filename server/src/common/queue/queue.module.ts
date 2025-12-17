import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL,
        tls: {}
      },
    }),
  ],
  exports: [BullModule]
})
export class QueueModule {}
