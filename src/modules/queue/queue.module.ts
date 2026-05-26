import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookProcessor } from './processors/webhook.processor';
import { MessageProcessor } from './processors/message.processor';
import { QUEUE_NAMES } from './queue-names';
import { Webhook } from '../webhook/entities/webhook.entity';
import { MessageBatch } from '../message/entities/message-batch.entity';
import { HooksModule } from '../../core/hooks/hooks.module';
import { SessionModule } from '../session/session.module';

// Re-export for backward compatibility
export { QUEUE_NAMES } from './queue-names';

@Module({
  imports: [
    // Required for WebhookProcessor to inject Repository<Webhook>
    TypeOrmModule.forFeature([Webhook], 'data'),
    // Required for MessageProcessor to inject Repository<MessageBatch>
    TypeOrmModule.forFeature([MessageBatch], 'data'),
    // Required for WebhookProcessor to inject HookManager
    HooksModule,
    // Required for MessageProcessor to inject SessionService
    SessionModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host', 'localhost'),
          port: configService.get<number>('redis.port', 6379),
          password: configService.get<string>('redis.password'),
        },
      }),
    }),
    BullModule.registerQueue({ name: QUEUE_NAMES.WEBHOOK }),
    BullModule.registerQueue({ name: QUEUE_NAMES.MESSAGE }),
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature({
      name: QUEUE_NAMES.WEBHOOK,
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: QUEUE_NAMES.MESSAGE,
      adapter: BullMQAdapter,
    }),
  ],
  providers: [WebhookProcessor, MessageProcessor],
  exports: [BullModule],
})
export class QueueModule {}
