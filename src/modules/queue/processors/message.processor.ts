import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createLogger } from '../../../common/services/logger.service';
import { QUEUE_NAMES } from '../queue-names';
import { MessageBatch, BatchStatus, BatchMessageStatus } from '../../message/entities/message-batch.entity';
import { SessionService } from '../../session/session.service';

export interface MessageJobData {
  sessionId: string;
  batchId: string;
  messageIndex: number;
  chatId: string;
  type: string; // 'text' | 'image' | 'video' | 'audio' | 'document'
  content: Record<string, unknown>;
}

export interface MessageJobResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

@Processor(QUEUE_NAMES.MESSAGE)
export class MessageProcessor extends WorkerHost {
  private readonly logger = createLogger('MessageProcessor');

  constructor(
    @InjectRepository(MessageBatch, 'data')
    private readonly batchRepository: Repository<MessageBatch>,
    private readonly sessionService: SessionService,
  ) {
    super();
  }

  async process(job: Job<MessageJobData>): Promise<MessageJobResult> {
    const { sessionId, batchId, messageIndex, chatId, type, content } = job.data;

    this.logger.log(`Processing message job ${job.id}`, {
      sessionId,
      batchId,
      messageIndex,
      chatId,
      type,
      attempt: job.attemptsMade + 1,
      action: 'message_process_start',
    });

    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      const error = `Session '${sessionId}' is not active`;
      this.logger.error(`Message job failed — no active session`, error, {
        sessionId,
        batchId,
        messageIndex,
        action: 'message_no_session',
      });
      await this.updateMessageStatus(batchId, messageIndex, 'failed', undefined, error);
      throw new Error(error);
    }

    try {
      let result: { id: string };

      switch (type) {
        case 'text':
          result = await engine.sendTextMessage(chatId, content.text as string);
          break;
        case 'image':
          result = await engine.sendImageMessage(chatId, {
            mimetype: (content.mimetype as string | undefined) ?? 'image/jpeg',
            data: (content.url as string | undefined) ?? (content.data as string),
            caption: content.caption as string | undefined,
          });
          break;
        case 'video':
          result = await engine.sendVideoMessage(chatId, {
            mimetype: (content.mimetype as string | undefined) ?? 'video/mp4',
            data: (content.url as string | undefined) ?? (content.data as string),
            caption: content.caption as string | undefined,
          });
          break;
        case 'audio':
          result = await engine.sendAudioMessage(chatId, {
            mimetype: (content.mimetype as string | undefined) ?? 'audio/mpeg',
            data: (content.url as string | undefined) ?? (content.data as string),
          });
          break;
        case 'document':
          result = await engine.sendDocumentMessage(chatId, {
            mimetype: (content.mimetype as string | undefined) ?? 'application/octet-stream',
            data: (content.url as string | undefined) ?? (content.data as string),
            filename: content.filename as string | undefined,
          });
          break;
        default:
          throw new Error(`Unsupported message type: ${type}`);
      }

      await this.updateMessageStatus(batchId, messageIndex, 'sent', result.id);

      this.logger.log(`Message job delivered successfully`, {
        sessionId,
        batchId,
        messageIndex,
        chatId,
        type,
        messageId: result.id,
        attempt: job.attemptsMade + 1,
        action: 'message_delivered',
      });

      return { success: true, messageId: result.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error(`Message job failed`, errorMessage, {
        sessionId,
        batchId,
        messageIndex,
        chatId,
        type,
        attempt: job.attemptsMade + 1,
        action: 'message_failed',
      });

      await this.updateMessageStatus(batchId, messageIndex, 'failed', undefined, errorMessage);

      // Re-throw to trigger BullMQ retry
      throw error;
    }
  }

  private async updateMessageStatus(
    batchId: string,
    messageIndex: number,
    status: 'sent' | 'failed',
    messageId?: string,
    errorMessage?: string,
  ): Promise<void> {
    const batch = await this.batchRepository.findOne({ where: { batchId } });
    if (!batch) {
      this.logger.warn(`Batch '${batchId}' not found when updating message status`, {
        batchId,
        messageIndex,
        action: 'batch_not_found',
      });
      return;
    }

    // Update the individual message result in the results array
    const results = batch.results || [];

    // Ensure results array is long enough
    while (results.length <= messageIndex) {
      results.push({ chatId: batch.messages[results.length]?.chatId ?? '', status: BatchMessageStatus.PENDING });
    }

    if (status === 'sent') {
      results[messageIndex] = {
        chatId: batch.messages[messageIndex]?.chatId ?? results[messageIndex].chatId,
        status: BatchMessageStatus.SENT,
        messageId,
        sentAt: new Date(),
      };
      batch.progress.sent = (batch.progress.sent || 0) + 1;
    } else {
      results[messageIndex] = {
        chatId: batch.messages[messageIndex]?.chatId ?? results[messageIndex].chatId,
        status: BatchMessageStatus.FAILED,
        error: { code: 'SEND_FAILED', message: errorMessage ?? 'Unknown error' },
      };
      batch.progress.failed = (batch.progress.failed || 0) + 1;
    }

    batch.progress.pending = Math.max(0, (batch.progress.pending || 0) - 1);
    batch.results = results;

    // Recalculate overall batch status
    batch.status = this.recalculateBatchStatus(batch);

    // TypeORM requires explicit save for JSON column mutations
    await this.batchRepository.save(batch);
  }

  private recalculateBatchStatus(batch: MessageBatch): BatchStatus {
    const { total, sent, failed, pending } = batch.progress;

    if (pending > 0) {
      return BatchStatus.PROCESSING;
    }

    if (sent === 0 && failed > 0) {
      return BatchStatus.FAILED;
    }

    if (failed > 0 && sent + failed === total) {
      // Partially failed but some sent — consider completed
      return BatchStatus.COMPLETED;
    }

    return BatchStatus.COMPLETED;
  }
}
