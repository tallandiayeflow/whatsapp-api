import { Controller, Post, Body, Req, BadRequestException, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { MessageService } from './message.service';
import { BulkMessageService } from './bulk-message.service';
import {
  SendTextMessageDto,
  SendMediaMessageDto,
  MessageResponseDto,
  SendPollMessageDto,
  EditTextMessageDto,
  MarkChatReadDto,
  SetPresenceDto,
  SendViewOnceMediaDto,
  SendTextWithMentionsDto,
} from './dto';
import { SendBulkMessageDto, BulkMessageResponseDto } from './dto/bulk-message.dto';
import { RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKeyRole, ApiKey } from '../auth/entities/api-key.entity';
import { SessionService } from '../session/session.service';
import { SessionStatus } from '../session/entities/session.entity';

type AuthedRequest = Request & { apiKey?: ApiKey };

@ApiTags('messages')
@Controller('messages')
export class SimpleMessageController {
  constructor(
    private readonly messageService: MessageService,
    private readonly bulkMessageService: BulkMessageService,
    private readonly sessionService: SessionService,
  ) {}

  private async resolveSession(req: AuthedRequest): Promise<string> {
    const apiKey = req.apiKey;
    if (!apiKey) throw new BadRequestException('API key required');

    // 1. Explicit defaultSessionId set on the key
    if (apiKey.defaultSessionId) return apiKey.defaultSessionId;

    // 2. Key restricted to exactly one session
    if (apiKey.allowedSessions?.length === 1) return apiKey.allowedSessions[0];

    // 3. Auto-select if only one READY session exists
    const sessions = await this.sessionService.findAll();
    const ready = sessions.filter(s => s.status === SessionStatus.READY);

    if (ready.length === 1) return ready[0].id;

    if (ready.length === 0) {
      throw new BadRequestException('No active WhatsApp session. Go to the dashboard and start a session first.');
    }

    throw new BadRequestException(
      `${ready.length} sessions are active. Link your API key to a specific session from the dashboard (API Keys → set a default session).`,
    );
  }

  @Post('send-text')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Send a text message (session resolved from API key)' })
  @ApiResponse({ status: 201, type: MessageResponseDto })
  async sendText(@Body() dto: SendTextMessageDto, @Req() req: AuthedRequest): Promise<MessageResponseDto> {
    const sessionId = await this.resolveSession(req);
    return this.messageService.sendText(sessionId, dto);
  }

  @Post('send-image')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Send an image (session resolved from API key)' })
  @ApiResponse({ status: 201, type: MessageResponseDto })
  async sendImage(@Body() dto: SendMediaMessageDto, @Req() req: AuthedRequest): Promise<MessageResponseDto> {
    const sessionId = await this.resolveSession(req);
    return this.messageService.sendImage(sessionId, dto);
  }

  @Post('send-video')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Send a video (session resolved from API key)' })
  @ApiResponse({ status: 201, type: MessageResponseDto })
  async sendVideo(@Body() dto: SendMediaMessageDto, @Req() req: AuthedRequest): Promise<MessageResponseDto> {
    const sessionId = await this.resolveSession(req);
    return this.messageService.sendVideo(sessionId, dto);
  }

  @Post('send-audio')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Send an audio/voice message (session resolved from API key)' })
  @ApiResponse({ status: 201, type: MessageResponseDto })
  async sendAudio(@Body() dto: SendMediaMessageDto, @Req() req: AuthedRequest): Promise<MessageResponseDto> {
    const sessionId = await this.resolveSession(req);
    return this.messageService.sendAudio(sessionId, dto);
  }

  @Post('send-document')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Send a document (session resolved from API key)' })
  @ApiResponse({ status: 201, type: MessageResponseDto })
  async sendDocument(@Body() dto: SendMediaMessageDto, @Req() req: AuthedRequest): Promise<MessageResponseDto> {
    const sessionId = await this.resolveSession(req);
    return this.messageService.sendDocument(sessionId, dto);
  }

  @Post('send-location')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Send a location (session resolved from API key)' })
  @ApiResponse({ status: 201, type: MessageResponseDto })
  async sendLocation(
    @Body() dto: { chatId: string; latitude: number; longitude: number; description?: string; address?: string },
    @Req() req: AuthedRequest,
  ): Promise<MessageResponseDto> {
    const sessionId = await this.resolveSession(req);
    return this.messageService.sendLocation(sessionId, dto);
  }

  @Post('send-contact')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Send a contact card (session resolved from API key)' })
  @ApiResponse({ status: 201, type: MessageResponseDto })
  async sendContact(
    @Body() dto: { chatId: string; contactName: string; contactNumber: string },
    @Req() req: AuthedRequest,
  ): Promise<MessageResponseDto> {
    const sessionId = await this.resolveSession(req);
    return this.messageService.sendContact(sessionId, dto);
  }

  @Post('send-bulk')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Send messages to multiple recipients (session resolved from API key)' })
  @ApiResponse({ status: 202, type: BulkMessageResponseDto })
  async sendBulk(@Body() dto: SendBulkMessageDto, @Req() req: AuthedRequest): Promise<BulkMessageResponseDto> {
    const sessionId = await this.resolveSession(req);
    const batch = await this.bulkMessageService.createBatch(sessionId, dto);
    const estimatedTime = new Date(Date.now() + batch.messages.length * (batch.options?.delayBetweenMessages || 3000));
    return {
      batchId: batch.batchId,
      status: batch.status,
      totalMessages: batch.messages.length,
      estimatedCompletionTime: estimatedTime.toISOString(),
      statusUrl: `/api/sessions/${sessionId}/messages/batch/${batch.batchId}`,
    };
  }

  @Post('send-poll')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Send a poll message (session resolved from API key)' })
  @ApiResponse({ status: 201, type: MessageResponseDto })
  async sendPoll(@Body() dto: SendPollMessageDto, @Req() req: AuthedRequest): Promise<MessageResponseDto> {
    const sessionId = await this.resolveSession(req);
    return this.messageService.sendPoll(sessionId, dto);
  }

  @Post('edit-message')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Edit a sent text message (session resolved from API key)' })
  @ApiResponse({ status: 204, description: 'Message edited' })
  async editMessage(@Body() dto: EditTextMessageDto, @Req() req: AuthedRequest): Promise<void> {
    const sessionId = await this.resolveSession(req);
    return this.messageService.editMessage(sessionId, dto);
  }

  @Post('mark-read')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark a chat as read (session resolved from API key)' })
  @ApiResponse({ status: 204, description: 'Chat marked as read' })
  async markRead(@Body() dto: MarkChatReadDto, @Req() req: AuthedRequest): Promise<void> {
    const sessionId = await this.resolveSession(req);
    return this.messageService.markChatRead(sessionId, dto);
  }

  @Post('set-presence')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Set typing/recording/paused presence (session resolved from API key)' })
  @ApiResponse({ status: 204, description: 'Presence set' })
  async setPresence(@Body() dto: SetPresenceDto, @Req() req: AuthedRequest): Promise<void> {
    const sessionId = await this.resolveSession(req);
    return this.messageService.setPresence(sessionId, dto);
  }

  @Post('send-view-once')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Send a view-once image or video (session resolved from API key)' })
  @ApiResponse({ status: 201, type: MessageResponseDto })
  async sendViewOnce(@Body() dto: SendViewOnceMediaDto, @Req() req: AuthedRequest): Promise<MessageResponseDto> {
    const sessionId = await this.resolveSession(req);
    return this.messageService.sendViewOnce(sessionId, dto);
  }

  @Post('send-with-mentions')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Send a text message with mentions (session resolved from API key)' })
  @ApiResponse({ status: 201, type: MessageResponseDto })
  async sendWithMentions(@Body() dto: SendTextWithMentionsDto, @Req() req: AuthedRequest): Promise<MessageResponseDto> {
    const sessionId = await this.resolveSession(req);
    return this.messageService.sendWithMentions(sessionId, dto);
  }
}
