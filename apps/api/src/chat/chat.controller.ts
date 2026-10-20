import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get('channels')
  listChannels(@CurrentUser('id') userId: string) {
    return this.chatService.listChannels(userId);
  }

  @Get('people')
  listPeople(@CurrentUser('id') userId: string) {
    return this.chatService.listPeople(userId);
  }

  @Get('direct-messages')
  listDirectMessages(@CurrentUser('id') userId: string) {
    return this.chatService.listDirectMessages(userId);
  }

  @Post('direct-messages/:recipientId')
  getOrCreateDirectMessage(
    @CurrentUser('id') userId: string,
    @Param('recipientId') recipientId: string,
  ) {
    return this.chatService.getOrCreateDirectMessage(userId, recipientId);
  }

  @Get('direct-messages/:dmId/messages')
  listDirectMessageMessages(
    @CurrentUser('id') userId: string,
    @Param('dmId') dmId: string,
  ) {
    return this.chatService.listDirectMessageMessages(userId, dmId);
  }

  @Post('direct-messages/:dmId/messages')
  createDirectMessage(
    @CurrentUser('id') userId: string,
    @Param('dmId') dmId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.createDirectMessage(userId, dmId, dto).then((message) => {
      this.chatGateway.publishMessage(message);
      return message;
    });
  }

  @Get('channels/:channelId/messages')
  listMessages(
    @CurrentUser('id') userId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.chatService.listMessages(userId, channelId);
  }

  @Get('channels/:channelId/members')
  listMembers(
    @CurrentUser('id') userId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.chatService.listMembers(userId, channelId);
  }

  @Post('channels/:channelId/messages')
  createMessage(
    @CurrentUser('id') userId: string,
    @Param('channelId') channelId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.createMessage(userId, channelId, dto).then((message) => {
      this.chatGateway.publishMessage(message);
      return message;
    });
  }
}
