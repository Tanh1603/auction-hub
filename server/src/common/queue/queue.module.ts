import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => {
        const redisUrl = process.env.REDIS_URL;
        const isTls = redisUrl?.startsWith('rediss://');

        return {
          connection: {
            url: redisUrl,
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT
              ? parseInt(process.env.REDIS_PORT)
              : undefined,
            tls: isTls
              ? {
                  rejectUnauthorized: false, // Often needed for external providers
                }
              : undefined,
          },
        };
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
