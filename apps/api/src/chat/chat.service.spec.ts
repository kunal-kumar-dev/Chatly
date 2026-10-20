import { prisma } from '@chatly/database';
import { ForbiddenException } from '@nestjs/common';
import { ChatService } from './chat.service';

jest.mock('@chatly/database', () => ({
  prisma: {
    channel: { findFirst: jest.fn() },
    message: { create: jest.fn() },
  },
}));

describe('ChatService', () => {
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
});
