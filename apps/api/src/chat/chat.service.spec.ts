import { prisma } from '@chatly/database';
import { ForbiddenException } from '@nestjs/common';
import { ChatService } from './chat.service';

jest.mock('@chatly/database', () => ({
  prisma: {
    channel: { findFirst: jest.fn() },
    dM: { findMany: jest.fn(), findFirst: jest.fn(), upsert: jest.fn() },
    userWorkspace: { findMany: jest.fn(), findFirst: jest.fn() },
    message: { create: jest.fn(), findMany: jest.fn() },
  },
}));

describe('ChatService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores a new message in the selected channel', async () => {
    const service = new ChatService();
    const date = new Date('2024-01-01T10:00:00.000Z');
    jest.mocked(prisma.channel.findFirst).mockImplementation(() => Promise.resolve({
      id: 'channel-id',
      workspaceId: 'workspace-id',
      type: 'public',
      isArchived: false,
      members: [],
    }) as never);
    jest.mocked(prisma.message.create).mockImplementation(() => Promise.resolve({
      id: 'message-id',
      channelId: 'channel-id',
      content: 'Hello, Chatly!',
      createdAt: date,
      sender: {
        displayName: 'Test User',
        firstName: 'Test',
        lastName: 'User',
      },
    }) as never);

    const message = await service.createMessage('user-id', 'channel-id', {
      content: 'Hello, Chatly!',
    });

    expect(message.author).toBe('Test User');
    expect(message.createdAt).toBe(date.toISOString());
    expect(prisma.message.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        workspaceId: 'workspace-id',
        channelId: 'channel-id',
        senderId: 'user-id',
        content: 'Hello, Chatly!',
      }),
    }));
  });

  it('denies access to a private channel when the user is not a member', async () => {
    const service = new ChatService();
    jest.mocked(prisma.channel.findFirst).mockImplementation(() => Promise.resolve({
      id: 'private-channel',
      workspaceId: 'workspace-id',
      type: 'private',
      isArchived: false,
      members: [],
    }) as never);

    await expect(
      service.ensureChannelAccess('user-id', 'private-channel'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates a one-to-one conversation only with a shared workspace member', async () => {
    const service = new ChatService();
    jest.mocked(prisma.userWorkspace.findMany).mockImplementation(() => Promise.resolve([
      { workspaceId: 'workspace-id' },
    ]) as never);
    jest.mocked(prisma.userWorkspace.findFirst).mockImplementation(() => Promise.resolve({
      workspaceId: 'workspace-id',
    }) as never);
    jest.mocked(prisma.dM.upsert).mockImplementation(() => Promise.resolve({
      id: 'dm-id',
      workspaceId: 'workspace-id',
      user1Id: 'recipient-id',
      user2Id: 'user-id',
      user1: {
        id: 'recipient-id',
        displayName: 'Other User',
        firstName: 'Other',
        lastName: 'User',
        avatarUrl: null,
      },
      user2: {
        id: 'user-id',
        displayName: 'Test User',
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: null,
      },
    }) as never);

    const conversation = await service.getOrCreateDirectMessage('user-id', 'recipient-id');

    expect(conversation).toEqual({
      id: 'dm-id',
      workspaceId: 'workspace-id',
      peer: { id: 'recipient-id', name: 'Other User', avatarUrl: null },
    });
    expect(prisma.dM.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        user1Id_user2Id: { user1Id: 'recipient-id', user2Id: 'user-id' },
      },
      create: expect.objectContaining({
        workspaceId: 'workspace-id',
        user1Id: 'recipient-id',
        user2Id: 'user-id',
      }),
    }));
  });

  it('does not allow starting a direct conversation with yourself', async () => {
    const service = new ChatService();

    await expect(
      service.getOrCreateDirectMessage('user-id', 'user-id'),
    ).rejects.toThrow('You cannot start a conversation with yourself');
    expect(prisma.userWorkspace.findMany).not.toHaveBeenCalled();
  });

  it('does not expose a direct conversation to a non-participant', async () => {
    const service = new ChatService();
    jest.mocked(prisma.dM.findFirst).mockImplementation(() => Promise.resolve(null) as never);

    await expect(
      service.ensureDirectMessageAccess('outsider-id', 'dm-id'),
    ).rejects.toThrow('Conversation not found');
    expect(prisma.dM.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'dm-id',
        OR: [{ user1Id: 'outsider-id' }, { user2Id: 'outsider-id' }],
      }),
    }));
  });

  it('persists a direct message against the conversation and returns its DM id', async () => {
    const service = new ChatService();
    const date = new Date('2024-02-01T10:00:00.000Z');
    jest.mocked(prisma.dM.findFirst).mockImplementation(() => Promise.resolve({
      id: 'dm-id',
      workspaceId: 'workspace-id',
      user1Id: 'recipient-id',
      user2Id: 'user-id',
    }) as never);
    jest.mocked(prisma.message.create).mockImplementation(() => Promise.resolve({
      id: 'dm-message-id',
      dmId: 'dm-id',
      channelId: null,
      content: 'Private hello',
      createdAt: date,
      sender: {
        displayName: 'Test User',
        firstName: 'Test',
        lastName: 'User',
      },
    }) as never);

    const message = await service.createDirectMessage('user-id', 'dm-id', {
      content: '  Private hello  ',
    });

    expect(message).toMatchObject({
      id: 'dm-message-id',
      channelId: null,
      dmId: 'dm-id',
      author: 'Test User',
      content: 'Private hello',
      createdAt: date.toISOString(),
    });
    expect(prisma.message.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        workspaceId: 'workspace-id',
        dmId: 'dm-id',
        senderId: 'user-id',
        content: 'Private hello',
      }),
    }));
  });
});
