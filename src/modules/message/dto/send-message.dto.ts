import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsUrl,
  ValidateIf,
  IsArray,
  IsBoolean,
  IsIn,
} from 'class-validator';

export class SendTextMessageDto {
  @ApiProperty({
    description: 'WhatsApp chat ID (phone@c.us for individual, groupId@g.us for groups)',
    example: '628123456789@c.us',
  })
  @IsString()
  @IsNotEmpty()
  chatId: string;

  @ApiProperty({
    description: 'Text message content',
    example: 'Hello from OpenWA!',
    maxLength: 4096,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  text: string;
}

export class SendMediaMessageDto {
  @ApiProperty({
    description: 'WhatsApp chat ID',
    example: '628123456789@c.us',
  })
  @IsString()
  @IsNotEmpty()
  chatId: string;

  @ApiPropertyOptional({
    description: 'Media URL (http/https)',
    example: 'https://example.com/image.jpg',
  })
  @IsOptional()
  @IsUrl()
  @ValidateIf((o: SendMediaMessageDto) => !o.base64)
  url?: string;

  @ApiPropertyOptional({
    description: 'Base64 encoded media data',
  })
  @IsOptional()
  @IsString()
  @ValidateIf((o: SendMediaMessageDto) => !o.url)
  base64?: string;

  @ApiPropertyOptional({
    description: 'Media MIME type (required when using base64)',
    example: 'image/jpeg',
  })
  @IsOptional()
  @IsString()
  mimetype?: string;

  @ApiPropertyOptional({
    description: 'Filename for the media',
    example: 'image.jpg',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  filename?: string;

  @ApiPropertyOptional({
    description: 'Caption for the media',
    example: 'Check out this image!',
    maxLength: 1024,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  caption?: string;
}

export class MessageResponseDto {
  @ApiProperty({ example: 'true_628123456789@c.us_3EB0123456789' })
  messageId: string;

  @ApiProperty({ example: 1706868000 })
  timestamp: number;
}

export class SendPollMessageDto {
  @ApiProperty({ description: 'WhatsApp chat ID', example: '628123456789@c.us' })
  @IsString()
  @IsNotEmpty()
  chatId: string;

  @ApiProperty({ description: 'Poll question', example: 'What is your favourite colour?' })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({ description: 'Poll options', example: ['Red', 'Green', 'Blue'] })
  @IsArray()
  @IsString({ each: true })
  options: string[];

  @ApiPropertyOptional({ description: 'Allow multiple answers', example: false })
  @IsBoolean()
  @IsOptional()
  allowMultipleAnswers?: boolean;
}

export class EditTextMessageDto {
  @ApiProperty({ description: 'Message ID to edit', example: 'true_628123456789@c.us_3EB0123456789' })
  @IsString()
  @IsNotEmpty()
  messageId: string;

  @ApiProperty({ description: 'New text content', example: 'Updated message text' })
  @IsString()
  @IsNotEmpty()
  newText: string;
}

export class MarkChatReadDto {
  @ApiProperty({ description: 'WhatsApp chat ID', example: '628123456789@c.us' })
  @IsString()
  @IsNotEmpty()
  chatId: string;
}

export class SetPresenceDto {
  @ApiProperty({ description: 'WhatsApp chat ID', example: '628123456789@c.us' })
  @IsString()
  @IsNotEmpty()
  chatId: string;

  @ApiProperty({ description: 'Presence state', enum: ['typing', 'recording', 'paused'], example: 'typing' })
  @IsIn(['typing', 'recording', 'paused'])
  presence: 'typing' | 'recording' | 'paused';
}

export class SendViewOnceMediaDto {
  @ApiProperty({ description: 'WhatsApp chat ID', example: '628123456789@c.us' })
  @IsString()
  @IsNotEmpty()
  chatId: string;

  @ApiProperty({ description: 'Media URL', example: 'https://example.com/image.jpg' })
  @IsUrl()
  url: string;

  @ApiProperty({ description: 'Media type', enum: ['image', 'video'], example: 'image' })
  @IsIn(['image', 'video'])
  mediaType: 'image' | 'video';
}

export class SendTextWithMentionsDto {
  @ApiProperty({ description: 'WhatsApp chat ID', example: '628123456789@c.us' })
  @IsString()
  @IsNotEmpty()
  chatId: string;

  @ApiProperty({ description: 'Message text with @mentions', example: 'Hello @628111@c.us!' })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({ description: 'WID strings of mentioned participants', example: ['628111111111@c.us'] })
  @IsArray()
  @IsString({ each: true })
  mentionedIds: string[];
}
