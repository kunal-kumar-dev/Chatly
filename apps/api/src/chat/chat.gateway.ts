import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { prisma } from '@chatly/database';
import { Server, Socket } from 'socket.io';
import { ChatMessage, ChatService } from './chat.service';

@WebSocketGateway({
  namespace: '/',
  cors: {
    origin: process.env.WEB_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: ChatService,
  ) {}

  @WebSocketServer()
  server!: Server;

  async handleConnection(client: Socket): Promise<void> {
    const token = this.accessToken(client);
    if (!token) {
      client.emit('chat:error', { message: 'Authentication required' });
      client.disconnect();
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, isActive: true, deletedAt: true },
      });

      if (!user?.isActive || user.deletedAt) {
        client.emit('chat:error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }
      client.data.userId = user.id;
      client.emit('chat:ready');
    } catch (error) {
      this.logger.warn(`Rejected unauthenticated chat socket: ${String(error)}`);
      client.emit('chat:error', { message: 'Authentication required' });
      client.disconnect();
    }
  }

  @SubscribeMessage('chat:join')
  async joinChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { channelId?: string },
  ): Promise<void> {
    if (!client.data.userId || !body?.channelId) {
      client.emit('chat:error', { message: 'A valid channel is required' });
      return;
    }

    try {
      await this.chatService.ensureChannelAccess(client.data.userId, body.channelId);
      await client.join(body.channelId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to join channel';
      client.emit('chat:error', { message });
    }
  }

  @SubscribeMessage('dm:join')
  async joinDirectMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { dmId?: string },
  ): Promise<void> {
    if (!client.data.userId || !body?.dmId) {
      client.emit('chat:error', { message: 'A valid direct conversation is required' });
      return;
    }

    try {
      await this.chatService.ensureDirectMessageAccess(client.data.userId, body.dmId);
      await client.join(`dm:${body.dmId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to join conversation';
      client.emit('chat:error', { message });
    }
  }

  @SubscribeMessage('chat:leave')
  leaveChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { channelId?: string },
  ): void {
    if (body?.channelId) {
      void client.leave(body.channelId);
    }
  }

  @SubscribeMessage('dm:leave')
  leaveDirectMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { dmId?: string },
  ): void {
    if (body?.dmId) {
      void client.leave(`dm:${body.dmId}`);
    }
  }

  publishMessage(message: ChatMessage): void {
    const room = message.dmId ? `dm:${message.dmId}` : message.channelId;
    if (room) this.server.to(room).emit('chat:message', message);
  }

  private accessToken(client: Socket): string | undefined {
    const authToken = client.handshake.auth?.accessToken;
    if (typeof authToken === 'string') return authToken;

    const authorization = client.handshake.headers.authorization;
    if (typeof authorization !== 'string') return undefined;
    const [type, token] = authorization.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
