'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { io, Socket } from 'socket.io-client';

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
};

type Channel = {
  id: string;
  name: string;
  description: string;
  workspaceId: string;
  memberCount: number;
};

type Message = {
  id: string;
  channelId: string | null;
  dmId: string | null;
  author: string;
  initials: string;
  color: string;
  content: string;
  createdAt: string;
};

type Member = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

type DirectConversation = {
  id: string;
  workspaceId: string;
  peer: Member;
};

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const SOCKET_URL = API_URL.replace(/\/api\/?$/, '');
const ACCESS_TOKEN_KEY = 'chatly.accessToken';
const REFRESH_TOKEN_KEY = 'chatly.refreshToken';
let refreshRequest: Promise<LoginResponse> | null = null;

async function refreshSession(): Promise<LoginResponse> {
  if (!refreshRequest) {
    const refreshToken = window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      throw new Error('Your session expired. Please sign in again.');
    }

    refreshRequest = fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (response) => {
        const result = await response.json() as LoginResponse & { message?: string };
        if (response.status === 401) {
          window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
          window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
          throw new Error(result.message || 'Your session expired. Please sign in again.');
        }
        if (!response.ok) {
          throw new Error('Session refresh is temporarily unavailable. Check the API and database, then try again.');
        }
        window.sessionStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken);
        window.sessionStorage.setItem(REFRESH_TOKEN_KEY, result.refreshToken);
        return result;
      })
      .finally(() => {
        refreshRequest = null;
      });
  }

  return refreshRequest;
}

async function apiRequest<T>(
  path: string,
  token: string,
  options: RequestInit = {},
  onTokenRefresh?: (token: string) => void,
): Promise<T> {
  const send = (accessToken: string) => fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  let response = await send(token);
  if (response.status === 401) {
    const session = await refreshSession();
    onTokenRefresh?.(session.accessToken);
    response = await send(session.accessToken);
  }

  if (!response.ok) {
    const body = await response.json() as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(message || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

function mergeMessages(...groups: Message[][]): Message[] {
  const unique = new Map<string, Message>();
  groups.flat().forEach((message) => unique.set(message.id, message));
  return Array.from(unique.values()).sort(
    (first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime(),
  );
}

function formatTime(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date));
}

function initialChannelId(channels: Channel[]): string {
  const linkedChannel = channels.find(
    (channel) => channel.name === window.location.hash.slice(1),
  );
  return linkedChannel?.id ?? channels[0]?.id ?? '';
}

export default function Home() {
  const [token, setToken] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectConversation[]>([]);
  const [people, setPeople] = useState<Member[]>([]);
  const [activeChannelId, setActiveChannelId] = useState('');
  const [activeDmId, setActiveDmId] = useState('');
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, Message[]>>({});
  const [members, setMembers] = useState<Member[]>([]);
  const [draft, setDraft] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [search, setSearch] = useState('');
  const [loginError, setLoginError] = useState('');
  const [databaseAvailable, setDatabaseAvailable] = useState<boolean | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [chatError, setChatError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isSocketAuthenticated, setIsSocketAuthenticated] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState('');
  const socketRef = useRef<Socket | null>(null);

  const activeChannel = channels.find((channel) => channel.id === activeChannelId);
  const activeDirectMessage = directMessages.find((conversation) => conversation.id === activeDmId);
  const activeConversationKey = activeDmId
    ? `dm:${activeDmId}`
    : activeChannelId ? `channel:${activeChannelId}` : '';
  const userName = user?.displayName || `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();
  const userInitials = userName.split(/\s+/).filter(Boolean).slice(0, 2)
    .map((part) => part[0].toUpperCase()).join('') || 'YO';
  const messages = useMemo(() => {
    const channelMessages = messagesByConversation[activeConversationKey] ?? [];
    const normalizedSearch = search.trim().toLowerCase();
    return normalizedSearch
      ? channelMessages.filter((message) =>
          `${message.author} ${message.content}`.toLowerCase().includes(normalizedSearch),
        )
      : channelMessages;
  }, [activeConversationKey, messagesByConversation, search]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/health/ready`)
      .then((response) => {
        if (!cancelled) setDatabaseAvailable(response.ok);
      })
      .catch(() => {
        if (!cancelled) setDatabaseAvailable(false);
      });

    const storedToken = window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
    const storedRefreshToken = window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
    if (!storedToken && !storedRefreshToken) {
      setIsLoading(false);
      return () => { cancelled = true; };
    }
    const sessionToken = storedToken ?? '';

    async function restoreSession() {
      try {
        const [profile, availableChannels, availableDirectMessages] = await Promise.all([
          apiRequest<User>('/auth/me', sessionToken, {}, setToken),
          apiRequest<Channel[]>('/chat/channels', sessionToken, {}, setToken),
          apiRequest<DirectConversation[]>('/chat/direct-messages', sessionToken, {}, setToken),
        ]);
        if (cancelled) return;
        setToken(window.sessionStorage.getItem(ACCESS_TOKEN_KEY) ?? sessionToken);
        setUser(profile);
        setChannels(availableChannels);
        setDirectMessages(availableDirectMessages);
        if (availableChannels.length > 0) {
          setActiveChannelId(initialChannelId(availableChannels));
        } else if (availableDirectMessages.length > 0) {
          setActiveDmId(availableDirectMessages[0].id);
        }
      } catch (error) {
        const refreshToken = window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
        if (!refreshToken) {
          window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
        }
        if (!cancelled) {
          setLoginError(refreshToken
            ? 'Unable to restore your session. Check the API and database, then try again.'
            : error instanceof Error ? error.message : 'Your session expired. Please sign in again.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void restoreSession();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!token) return;
    const socket = io(SOCKET_URL, {
      auth: { accessToken: token },
      reconnection: true,
    });
    socketRef.current = socket;
    socket.on('connect', () => setIsConnected(true));
    socket.on('chat:ready', () => setIsSocketAuthenticated(true));
    socket.on('disconnect', () => {
      setIsConnected(false);
      setIsSocketAuthenticated(false);
    });
    socket.on('connect_error', () => {
      setIsConnected(false);
      setIsSocketAuthenticated(false);
      setChatError('Realtime connection unavailable. Messages will still send through the API.');
    });
    socket.on('chat:error', (error: { message?: string }) => {
      setChatError(error.message || 'Could not join the selected channel.');
    });
    socket.on('chat:message', (message: Message) => {
      const key = message.dmId ? `dm:${message.dmId}` : `channel:${message.channelId}`;
      setMessagesByConversation((current) => ({
        ...current,
        [key]: mergeMessages(current[key] ?? [], [message]),
      }));
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !isSocketAuthenticated || (!activeChannelId && !activeDmId)) return;
    if (activeDmId) socket.emit('dm:join', { dmId: activeDmId });
    else socket.emit('chat:join', { channelId: activeChannelId });
    return () => {
      if (activeDmId) socket.emit('dm:leave', { dmId: activeDmId });
      else socket.emit('chat:leave', { channelId: activeChannelId });
    };
  }, [activeChannelId, activeDmId, isSocketAuthenticated, token]);

  useEffect(() => {
    if (!token || !activeConversationKey) return;
    let cancelled = false;
    setChatError('');
    const path = activeDmId
      ? `/chat/direct-messages/${activeDmId}/messages`
      : `/chat/channels/${activeChannelId}/messages`;
    apiRequest<Message[]>(path, token, {}, setToken)
      .then((loadedMessages) => {
        if (!cancelled) {
          setMessagesByConversation((current) => ({
            ...current,
            [activeConversationKey]: mergeMessages(
              loadedMessages,
              current[activeConversationKey] ?? [],
            ),
          }));
        }
      })
      .catch((error: Error) => {
        if (!cancelled) setChatError(error.message);
      });
    return () => { cancelled = true; };
  }, [activeConversationKey, activeDmId, activeChannelId, token]);

  useEffect(() => {
    if (!token || !membersOpen) return;
    if (activeDmId) {
      setMembers(activeDirectMessage ? [activeDirectMessage.peer] : []);
      return;
    }
    if (!activeChannelId) return;
    let cancelled = false;
    apiRequest<Member[]>(`/chat/channels/${activeChannelId}/members`, token, {}, setToken)
      .then((channelMembers) => {
        if (!cancelled) setMembers(channelMembers);
      })
      .catch((error: Error) => {
        if (!cancelled) setChatError(error.message);
      });
    return () => { cancelled = true; };
  }, [activeChannelId, activeDmId, activeDirectMessage, membersOpen, token]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError('');
    setIsLoading(true);
    try {
      const credentials = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const result = await credentials.json() as LoginResponse & { message?: string };
      if (!credentials.ok) {
        if (credentials.status >= 500) {
          setDatabaseAvailable(false);
          throw new Error('Sign-in is temporarily unavailable. Check that the API and database are running, then try again.');
        }
        throw new Error(result.message || 'Unable to sign in');
      }
      window.sessionStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken);
      window.sessionStorage.setItem(REFRESH_TOKEN_KEY, result.refreshToken);
      const [profile, availableChannels, availableDirectMessages] = await Promise.all([
        apiRequest<User>('/auth/me', result.accessToken, {}, setToken),
        apiRequest<Channel[]>('/chat/channels', result.accessToken, {}, setToken),
        apiRequest<DirectConversation[]>('/chat/direct-messages', result.accessToken, {}, setToken),
      ]);
      setToken(window.sessionStorage.getItem(ACCESS_TOKEN_KEY) ?? result.accessToken);
      setUser(profile);
      setChannels(availableChannels);
      setDirectMessages(availableDirectMessages);
      setActiveDmId('');
      if (availableChannels.length > 0) {
        setActiveChannelId(initialChannelId(availableChannels));
      } else if (availableDirectMessages.length > 0) {
        setActiveChannelId('');
        setActiveDmId(availableDirectMessages[0].id);
      } else {
        setActiveChannelId('');
      }
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Unable to sign in');
    } finally {
      setIsLoading(false);
    }
  }

  async function signOut() {
    const refreshToken = window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
    if (refreshToken) {
      try {
        const logoutRequest = (accessToken: string, token: string) => fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ refreshToken: token }),
        });
        const accessToken = window.sessionStorage.getItem(ACCESS_TOKEN_KEY) ?? '';
        let response = await logoutRequest(accessToken, refreshToken);
        if (response.status === 401) {
          const session = await refreshSession();
          response = await logoutRequest(session.accessToken, session.refreshToken);
        }
        if (!response.ok) {
          throw new Error('The server could not revoke this session.');
        }
      } catch {
        setLoginError('The session could not be revoked on the server. You are signed out on this device.');
      }
    }
    window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    setToken('');
    setUser(null);
    setChannels([]);
    setDirectMessages([]);
    setPeople([]);
    setMessagesByConversation({});
    setActiveChannelId('');
    setActiveDmId('');
    setNewMessageOpen(false);
    setMenuOpen(false);
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !token || !activeConversationKey || isSending) return;

    setIsSending(true);
    setChatError('');
    try {
      const path = activeDmId
        ? `/chat/direct-messages/${activeDmId}/messages`
        : `/chat/channels/${activeChannelId}/messages`;
      const message = await apiRequest<Message>(
        path,
        token,
        { method: 'POST', body: JSON.stringify({ content }) },
        setToken,
      );
      setMessagesByConversation((current) => ({
        ...current,
        [activeConversationKey]: mergeMessages(
          current[activeConversationKey] ?? [],
          [message],
        ),
      }));
      setDraft('');
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Message could not be sent');
    } finally {
      setIsSending(false);
    }
  }

  async function openPeoplePicker() {
    setNewMessageOpen((open) => !open);
    if (people.length > 0 || !token) return;
    try {
      const availablePeople = await apiRequest<Member[]>('/chat/people', token, {}, setToken);
      setPeople(availablePeople);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Workspace members could not be loaded');
    }
  }

  async function startDirectMessage(person: Member) {
    if (!token) return;
    setChatError('');
    try {
      const conversation = await apiRequest<DirectConversation>(
        `/chat/direct-messages/${person.id}`,
        token,
        { method: 'POST' },
        setToken,
      );
      setDirectMessages((current) => [
        conversation,
        ...current.filter((item) => item.id !== conversation.id),
      ]);
      setActiveChannelId('');
      setActiveDmId(conversation.id);
      setNewMessageOpen(false);
      setSearch('');
      setMembersOpen(false);
      setDetailsOpen(false);
      setMenuOpen(false);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Could not start direct conversation');
    }
  }

  async function copyChannelLink() {
    if (!activeChannel) return;
    try {
      const channelLink = `${window.location.origin}/#${activeChannel.name}`;
      await navigator.clipboard.writeText(channelLink);
      window.history.replaceState(null, '', `#${activeChannel.name}`);
      setToast('Channel link copied');
      window.setTimeout(() => setToast(''), 2200);
    } catch {
      setChatError('Could not copy the channel link');
    }
    setMenuOpen(false);
  }

  if (isLoading) {
    return <main className="auth-loading" aria-live="polite">Connecting to Chatly…</main>;
  }

  if (!token || !user) {
    return (
      <main className="login-screen">
        <div className="login-shell">
          <section className="login-brand" aria-label="About Chatly">
            <div className="login-brand-mark"><span className="login-logo">C</span><strong>Chatly</strong></div>
            <p className="login-eyebrow">A BETTER WAY TO WORK TOGETHER</p>
            <h1>Good conversations move teams forward.</h1>
            <p className="login-description">A calm, connected place for your team to share ideas, make decisions, and get great work done.</p>
            <div className="login-feature-list">
              <span><i /> Conversations that stay in sync</span>
              <span><i /> Group channels and private one-to-one chats</span>
              <span><i /> Your workspace, all in one place</span>
            </div>
            <div className="login-brand-foot">Thoughtful teamwork starts with a conversation.</div>
          </section>

          <form className="login-card" onSubmit={signIn}>
            <p className="login-eyebrow">WELCOME BACK</p>
            <h2>Sign in to Chatly</h2>
            <p className="login-description">Enter your account details to continue to your workspace.</p>
            {loginError && <p className="error-banner" role="alert">{loginError}</p>}
            {databaseAvailable === false && !loginError && (
              <p className="service-status unavailable" role="status">
                The chat service can’t reach its database. Start PostgreSQL, then try again.
              </p>
            )}
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              autoComplete="username"
              required
            />
            <div className="password-label">
              <label htmlFor="password">Password</label>
            </div>
            <div className="password-field">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >{showPassword ? 'Hide' : 'Show'}</button>
            </div>
            <button className="login-submit" type="submit">Sign in <span aria-hidden="true">→</span></button>
            <p className="login-footnote">Sign in to access your group and direct conversations.</p>
            <p className={`service-status ${databaseAvailable === false ? 'unavailable' : ''}`} role="status">
              <i />{databaseAvailable === null ? 'Checking workspace connection…' : databaseAvailable ? 'Workspace services are online' : 'Workspace services are offline'}
            </p>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="chat-app">
      <aside className="workspace-bar" aria-label="Workspace navigation">
        <div className="workspace-logo">C</div>
        <div className="workspace-dot" aria-label="Connected workspace" />
        <button className="add-workspace" type="button" aria-label="Add workspace" title="Add workspace">+</button>
      </aside>

      <aside className="channel-sidebar">
        <div className="workspace-title">
          <div>
            <strong>Chatly</strong>
            <span>Demo workspace</span>
          </div>
          <button type="button" aria-label="Workspace menu" title="Workspace menu">⌄</button>
        </div>

        <nav aria-label="Conversations">
          <p className="sidebar-heading">Group channels</p>
          {channels.map((channel) => (
            <button
              className={`channel-link ${channel.id === activeChannelId && !activeDmId ? 'active' : ''}`}
              key={channel.id}
              onClick={() => {
                setActiveChannelId(channel.id);
                setActiveDmId('');
                window.history.replaceState(null, '', `#${channel.name}`);
                setSearch('');
                setMembersOpen(false);
                setDetailsOpen(false);
              }}
              type="button"
            >
              <span>#</span>{channel.name}
            </button>
          ))}
          {channels.length === 0 && <p className="sidebar-empty">No group channels in this workspace.</p>}
          <div className="direct-message-heading">
            <p className="sidebar-heading">Direct messages</p>
            <button
              className="new-message-button"
              type="button"
              aria-label="Start a direct message"
              title="Start a direct message"
              onClick={() => { void openPeoplePicker(); }}
            >+</button>
          </div>
          {directMessages.map((conversation) => (
            <button
              className={`channel-link direct-message-link ${conversation.id === activeDmId ? 'active' : ''}`}
              key={conversation.id}
              onClick={() => {
                setActiveChannelId('');
                setActiveDmId(conversation.id);
                setSearch('');
                setMembersOpen(false);
                setDetailsOpen(false);
              }}
              type="button"
            >
              <span className="direct-message-presence" />{conversation.peer.name}
            </button>
          ))}
          {directMessages.length === 0 && <p className="sidebar-empty">No direct messages yet.</p>}
          {newMessageOpen && (
            <div className="people-picker">
              <p className="sidebar-heading">Start a conversation</p>
              {people.map((person) => (
                <button
                  className="channel-link"
                  key={person.id}
                  onClick={() => { void startDirectMessage(person); }}
                  type="button"
                >
                  <span className="direct-message-presence" />{person.name}
                </button>
              ))}
              {people.length === 0 && (
                <p className="sidebar-empty">No other active workspace members.</p>
              )}
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="profile-avatar">{userInitials}</div>
          <div className="profile-copy">
            <strong>{userName}</strong>
            <span><i /> Online</span>
          </div>
          <button type="button" aria-label="Sign out" title="Sign out" onClick={signOut}>⋮</button>
        </div>
      </aside>

      <section
        className="chat-panel"
        aria-label={activeDirectMessage
          ? `Direct message with ${activeDirectMessage.peer.name}`
          : `Channel ${activeChannel?.name ?? ''}`}
      >
        <header className="chat-header">
          <div>
            <h1>
              <span>{activeDirectMessage ? '@' : '#'}</span>{' '}
              {activeDirectMessage?.peer.name ?? activeChannel?.name ?? 'No conversation selected'}
            </h1>
            <p>{isConnected ? 'Connected · Messages update in real time' : 'Connecting to realtime chat…'}</p>
          </div>
          <div className="header-actions" aria-label="Conversation actions">
            <button
              type="button"
              aria-label="Search messages"
              aria-pressed={searchOpen}
              onClick={() => {
                setSearchOpen((open) => !open);
                setSearch('');
              }}
            >⌕</button>
            <button
              type="button"
              aria-label={activeDirectMessage ? 'Show conversation participant' : 'Show channel members'}
              aria-pressed={membersOpen}
              onClick={() => {
                setMembersOpen((open) => !open);
                setDetailsOpen(false);
              }}
            >◉</button>
            <div className="more-action">
              <button
                type="button"
                aria-label="More channel options"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >•••</button>
              {menuOpen && (
                <div className="options-menu" role="menu">
                  {activeChannel && (
                    <>
                      <button type="button" role="menuitem" onClick={() => {
                        setDetailsOpen(true);
                        setMembersOpen(true);
                        setMenuOpen(false);
                      }}>Channel details</button>
                      <button type="button" role="menuitem" onClick={copyChannelLink}>Copy channel link</button>
                    </>
                  )}
                  <button type="button" role="menuitem" onClick={signOut}>Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {searchOpen && (
          <div className="search-bar">
            <span aria-hidden="true">⌕</span>
            <input
              autoFocus
              aria-label="Search this channel"
              placeholder={`Search ${activeDirectMessage ? activeDirectMessage.peer.name : `#${activeChannel?.name ?? ''}`}`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button type="button" onClick={() => { setSearch(''); setSearchOpen(false); }}>Close</button>
          </div>
        )}

        {chatError && <div className="error-banner chat-error" role="alert">{chatError}</div>}
        {toast && <div className="toast" role="status">{toast}</div>}

        <div className={`chat-content ${membersOpen ? 'with-members' : ''}`}>
          <div className="message-column">
            <div className="connection-banner">
              <span className={isConnected ? 'connection-dot connected' : 'connection-dot'} />
              {isConnected ? 'Live updates are on' : 'Reconnecting to live updates'}
              {activeChannel && <span className="channel-description">{activeChannel.description}</span>}
              {activeDirectMessage && (
                <span className="channel-description">Private one-to-one conversation</span>
              )}
            </div>

            <div className="message-list" aria-live="polite">
              {messages.length === 0 ? (
                <div className="empty-state">
                  <div>✦</div>
                  <h2>{search ? 'No matching messages' : activeConversationKey ? 'No messages yet' : 'Choose a conversation'}</h2>
                  <p>{search
                    ? 'Try a different search.'
                    : activeDirectMessage
                      ? `Start a private conversation with ${activeDirectMessage.peer.name}.`
                      : activeChannel
                        ? `Start the group conversation in #${activeChannel.name}.`
                        : 'Choose a group channel or start a direct message.'}</p>
                </div>
              ) : (
                messages.map((message) => (
                  <article className="message" key={message.id}>
                    <div className={`message-avatar ${message.color}`}>{message.initials}</div>
                    <div className="message-body">
                      <div className="message-meta">
                        <strong>{message.author}</strong>
                        <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
                      </div>
                      <p>{message.content}</p>
                    </div>
                  </article>
                ))
              )}
            </div>

            <form className="composer" onSubmit={sendMessage}>
              <label className="sr-only" htmlFor="message">
                {activeDirectMessage
                  ? `Message ${activeDirectMessage.peer.name}`
                  : `Message #${activeChannel?.name ?? ''}`}
              </label>
              <input
                id="message"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={activeDirectMessage
                  ? `Message ${activeDirectMessage.peer.name}`
                  : activeChannel ? `Message #${activeChannel.name}` : 'Select a conversation'}
                autoComplete="off"
                maxLength={4000}
                disabled={!activeConversationKey || isSending}
              />
              <button
                type="submit"
                disabled={!draft.trim() || !activeConversationKey || isSending}
                aria-label="Send message"
              >↑</button>
            </form>
          </div>

          {membersOpen && (
            <aside className="members-panel" aria-label={detailsOpen ? 'Channel details' : 'Conversation participants'}>
              <div className="members-heading">
                <div>
                  <strong>{detailsOpen ? 'Channel details' : activeDirectMessage ? 'Conversation' : 'Members'}</strong>
                  <span>{detailsOpen
                    ? `#${activeChannel?.name ?? ''}`
                    : activeDirectMessage ? 'One-to-one chat' : `${members.length} people`}</span>
                </div>
                <button type="button" aria-label="Close members panel" onClick={() => {
                  setMembersOpen(false);
                  setDetailsOpen(false);
                }}>×</button>
              </div>
              {detailsOpen && activeChannel && (
                <div className="channel-details">
                  <span className="detail-hash">#</span>
                  <h2>{activeChannel?.name}</h2>
                  <p>{activeChannel?.description || 'No channel description.'}</p>
                  <span>{activeChannel?.memberCount ?? members.length} members</span>
                </div>
              )}
              <div className="member-list">
                {members.map((member) => (
                  <div className="member-row" key={member.id}>
                    {member.avatarUrl
                      ? <Image src={member.avatarUrl} alt="" width={32} height={32} unoptimized />
                      : <div className="member-avatar">{member.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('')}</div>}
                    <div>
                      <strong>{member.name}</strong>
                      <span><i /> Workspace member</span>
                    </div>
                  </div>
                ))}
                {members.length === 0 && <p className="sidebar-empty">No members to show.</p>}
              </div>
            </aside>
          )}
        </div>
      </section>
    </main>
  );
}
