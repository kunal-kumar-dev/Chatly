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
  channelId: string | null;
  dmId: string | null;
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

export type DirectConversation = {
  id: string;
  workspaceId: string;
  peer: ChatMember;
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

  async listPeople(userId: string): Promise<ChatMember[]> {
    const memberships = await prisma.userWorkspace.findMany({
      where: { userId },
      select: { workspaceId: true },
    });
    const workspaceIds = memberships.map(({ workspaceId }) => workspaceId);
    if (workspaceIds.length === 0) return [];

    const membershipsInWorkspaces = await prisma.userWorkspace.findMany({
      where: {
        workspaceId: { in: workspaceIds },
        userId: { not: userId },
        user: { isActive: true, deletedAt: null },
      },
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

    const people = new Map<string, ChatMember>();
    membershipsInWorkspaces.forEach(({ user }) => {
      if (!people.has(user.id)) {
        people.set(user.id, {
          id: user.id,
          name: this.displayName(user),
          avatarUrl: user.avatarUrl,
        });
      }
    });
    return Array.from(people.values()).sort((first, second) =>
      first.name.localeCompare(second.name),
    );
  }

  async listDirectMessages(userId: string): Promise<DirectConversation[]> {
    const conversations = await prisma.dM.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
        workspace: { users: { some: { userId } } },
      },
      include: {
        user1: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        user2: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        messages: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
      },
    });

    return conversations
      .map((conversation) => {
        const peer = conversation.user1Id === userId
          ? conversation.user2
          : conversation.user1;
        return {
          id: conversation.id,
          workspaceId: conversation.workspaceId,
          peer: {
            id: peer.id,
            name: this.displayName(peer),
            avatarUrl: peer.avatarUrl,
          },
          lastMessageAt: conversation.messages[0]?.createdAt ?? conversation.updatedAt,
        };
      })
      .sort((first, second) =>
        second.lastMessageAt.getTime() - first.lastMessageAt.getTime(),
      )
      .map(({ id, workspaceId, peer }) => ({ id, workspaceId, peer }));
  }

  async getOrCreateDirectMessage(
    userId: string,
    recipientId: string,
  ): Promise<DirectConversation> {
    if (userId === recipientId) {
      throw new BadRequestException('You cannot start a conversation with yourself');
    }

    const memberships = await prisma.userWorkspace.findMany({
      where: { userId },
      select: { workspaceId: true },
      orderBy: { createdAt: 'asc' },
    });
    const workspaceIds = memberships.map(({ workspaceId }) => workspaceId);
    const recipientMembership = await prisma.userWorkspace.findFirst({
      where: {
        userId: recipientId,
        workspaceId: { in: workspaceIds },
        user: { isActive: true, deletedAt: null },
      },
      select: { workspaceId: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!recipientMembership) {
      throw new NotFoundException('Workspace member not found');
    }

    const [user1Id, user2Id] = [userId, recipientId].sort();
    const conversation = await prisma.dM.upsert({
      where: { user1Id_user2Id: { user1Id, user2Id } },
      create: {
        workspaceId: recipientMembership.workspaceId,
        user1Id,
        user2Id,
      },
      update: { workspaceId: recipientMembership.workspaceId },
      include: {
        user1: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        user2: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });
    const peer = conversation.user1Id === userId
      ? conversation.user2
      : conversation.user1;

    return {
      id: conversation.id,
      workspaceId: conversation.workspaceId,
      peer: {
        id: peer.id,
        name: this.displayName(peer),
        avatarUrl: peer.avatarUrl,
      },
    };
  }

  async listDirectMessageMessages(
    userId: string,
    dmId: string,
  ): Promise<ChatMessage[]> {
    await this.ensureDirectMessageAccess(userId, dmId);
    const messages = await prisma.message.findMany({
      where: { dmId, isDeleted: false },
      include: {
        sender: {
          select: { displayName: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return messages.reverse().map((message) =>
      this.toChatMessage(message, null, dmId),
    );
  }

  async createDirectMessage(
    userId: string,
    dmId: string,
    dto: SendMessageDto,
  ): Promise<ChatMessage> {
    const conversation = await this.ensureDirectMessageAccess(userId, dmId);
    const content = dto.content.trim();
    if (!content) {
      throw new BadRequestException('Message content cannot be empty');
    }

    const message = await prisma.message.create({
      data: {
        workspaceId: conversation.workspaceId,
        dmId,
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

    return this.toChatMessage(message, null, dmId);
  }

  async ensureDirectMessageAccess(userId: string, dmId: string) {
    const conversation = await prisma.dM.findFirst({
      where: {
        id: dmId,
        OR: [{ user1Id: userId }, { user2Id: userId }],
        workspace: { users: { some: { userId } } },
      },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
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
      this.toChatMessage(message, channelId, null),
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

    return this.toChatMessage(message, channelId, null);
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
      dmId?: string | null;
      content: string | null;
      createdAt: Date;
      sender: {
        displayName: string | null;
        firstName: string;
        lastName: string;
      };
    },
    channelId: string | null,
    dmId: string | null,
  ): ChatMessage {
    const author = this.displayName(message.sender);
    return {
      id: message.id,
      channelId: message.channelId ?? channelId,
      dmId: message.dmId ?? dmId,
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
