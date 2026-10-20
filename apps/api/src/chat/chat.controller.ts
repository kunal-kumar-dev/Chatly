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
