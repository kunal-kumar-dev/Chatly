import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@chatly/database';
import { SendMessageDto } from './dto/send-message.dto';

export type ChatChannel = {
  id: string;
  name: string;
  description: string;
  workspaceId: string;
  memberCount: number;
};

export type ChatMessage = {
  id: string;
  channelId: string;
  author: string;
  initials: string;
  color: string;
  content: string;
  createdAt: string;
};

export type ChatMember = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

const AVATAR_COLORS = ['purple', 'blue', 'orange', 'green', 'pink'];

@Injectable()
export class ChatService {
  async listChannels(userId: string): Promise<ChatChannel[]> {
    const channels = await prisma.channel.findMany({
      where: {
        workspace: { users: { some: { userId } } },
        isArchived: false,
        deletedAt: null,
        OR: [
          { type: 'public' },
          { members: { some: { userId } } },
        ],
      },
      include: { _count: { select: { members: true } } },
      orderBy: { name: 'asc' },
    });

    return channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      description: channel.description ?? '',
      workspaceId: channel.workspaceId,
      memberCount: channel._count.members,
    }));
  }

  async listMessages(userId: string, channelId: string): Promise<ChatMessage[]> {
    await this.ensureChannelAccess(userId, channelId);
    const messages = await prisma.message.findMany({
      where: { channelId, isDeleted: false },
      include: {
        sender: {
          select: { displayName: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return messages.reverse().map((message) =>
      this.toChatMessage(message, channelId),
    );
  }

  async listMembers(userId: string, channelId: string): Promise<ChatMember[]> {
    const channel = await this.ensureChannelAccess(userId, channelId);

    if (channel.type === 'public') {
      const members = await prisma.userWorkspace.findMany({
        where: { workspaceId: channel.workspaceId },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      return members.map(({ user }) => ({
        id: user.id,
        name: this.displayName(user),
        avatarUrl: user.avatarUrl,
      }));
    }

    const members = await prisma.channelMember.findMany({
      where: { channelId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return members.map(({ user }) => ({
      id: user.id,
      name: this.displayName(user),
      avatarUrl: user.avatarUrl,
    }));
  }

  async createMessage(
    userId: string,
    channelId: string,
    dto: SendMessageDto,
  ): Promise<ChatMessage> {
    const channel = await this.ensureChannelAccess(userId, channelId);
    const content = dto.content.trim();
    if (!content) {
      throw new BadRequestException('Message content cannot be empty');
    }

    const message = await prisma.message.create({
      data: {
        workspaceId: channel.workspaceId,
        channelId,
        senderId: userId,
        content,
        type: 'text',
      },
      include: {
        sender: {
          select: { displayName: true, firstName: true, lastName: true },
        },
      },
    });

    return this.toChatMessage(message, channelId);
  }

  async ensureChannelAccess(userId: string, channelId: string) {
    const channel = await prisma.channel.findFirst({
      where: {
        id: channelId,
        deletedAt: null,
        workspace: { users: { some: { userId } } },
      },
      include: {
        members: { where: { userId }, select: { id: true } },
      },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }
    if (channel.isArchived) {
      throw new NotFoundException('Channel not found');
    }
    if (channel.type !== 'public' && channel.members.length === 0) {
      throw new ForbiddenException('You are not a member of this channel');
    }

    return channel;
  }

  private toChatMessage(
    message: {
      id: string;
      channelId?: string | null;
      content: string | null;
      createdAt: Date;
      sender: {
        displayName: string | null;
        firstName: string;
        lastName: string;
      };
    },
    channelId: string,
  ): ChatMessage {
    const author = this.displayName(message.sender);
    return {
      id: message.id,
      channelId: message.channelId ?? channelId,
      author,
      initials: this.initials(author),
      color: this.avatarColor(author),
      content: message.content ?? '',
      createdAt: message.createdAt.toISOString(),
    };
  }

  private displayName(user: {
    displayName: string | null;
    firstName: string;
    lastName: string;
  }): string {
    return user.displayName?.trim() || `${user.firstName} ${user.lastName}`.trim();
  }

  private initials(author: string): string {
    return author
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('') || 'YO';
  }

  private avatarColor(author: string): string {
    const value = [...author].reduce((sum, character) => sum + character.charCodeAt(0), 0);
    return AVATAR_COLORS[value % AVATAR_COLORS.length];
  }
}
