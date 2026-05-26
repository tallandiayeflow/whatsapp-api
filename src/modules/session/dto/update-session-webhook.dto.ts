import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSessionWebhookDto {
  @ApiPropertyOptional({
    description: 'Webhook URL to receive events for this session',
    example: 'https://example.com/webhook',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  webhookUrl?: string | null;

  @ApiPropertyOptional({
    description: 'List of events to subscribe to (e.g. message.received, message.deleted)',
    example: ['message.received', 'message.deleted'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  webhookEvents?: string[];

  @ApiPropertyOptional({
    description: 'Secret for HMAC-SHA256 webhook signature verification',
    example: 'my-secret',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  webhookSecret?: string | null;
}
