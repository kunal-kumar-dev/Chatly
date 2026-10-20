# Chatly API Documentation

> The API prefix is `/api`. Implemented routes include health and authentication
> endpoints plus the authenticated chat MVP documented below. The remaining
> routes in this document are target API specifications.

## REST API Endpoints

### Implemented Chat MVP
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| GET | `/chat/channels` | List accessible, unarchived workspace channels | Yes |
| GET | `/chat/channels/:channelId/messages` | Get the latest 100 messages in a channel | Yes |
| POST | `/chat/channels/:channelId/messages` | Persist and broadcast a text message (`content`, max 4000 chars) | Yes |
| GET | `/chat/channels/:channelId/members` | List channel members | Yes |

Public channels are visible to active workspace members; private channels
require channel membership. Messages are broadcast only to authorized members
who have joined the channel socket room.

### Authentication
| Method | Endpoint | Description | Auth Required | Permissions |
|---|---|---|---|---|
| POST | `/auth/register` | Register new user | No | - |
| POST | `/auth/login` | Login with email/password | No | - |
| POST | `/auth/refresh` | Refresh access token | No | - |
| POST | `/auth/logout` | Logout (revoke tokens) | Yes | - |
| POST | `/auth/forgot-password` | Request password reset | No | - |
| POST | `/auth/reset-password` | Reset password with token | No | - |
| GET | `/auth/me` | Get current user info | Yes | - |

### Users
| Method | Endpoint | Description | Auth Required | Permissions |
|---|---|---|---|---|
| GET | `/users` | List users in workspace | Yes | `user.read` |
| GET | `/users/:id` | Get user profile | Yes | `user.read` |
| PUT | `/users/:id` | Update user profile | Yes | `user.update` or self |
| DELETE | `/users/:id` | Delete user | Yes | `user.delete` |
| PUT | `/users/:id/status` | Update status message | Yes | Self only |
| PUT | `/users/:id/avatar` | Upload avatar | Yes | Self only |
| GET | `/users/search` | Search users | Yes | `user.read` |

### Workspaces
| Method | Endpoint | Description | Auth Required | Permissions |
|---|---|---|---|---|
| GET | `/workspaces/:id` | Get workspace details | Yes | Member of workspace |
| PUT | `/workspaces/:id` | Update workspace | Yes | `workspace.manage` |
| GET | `/workspaces/:id/settings` | Get workspace settings | Yes | `workspace.manage` |
| PUT | `/workspaces/:id/settings` | Update workspace settings | Yes | `workspace.manage` |

### Roles & Permissions (RBAC)
| Method | Endpoint | Description | Auth Required | Permissions |
|---|---|---|---|---|
| GET | `/roles` | List all roles | Yes | `role.read` |
| POST | `/roles` | Create custom role | Yes | `role.create` |
| GET | `/roles/:id` | Get role details with permissions | Yes | `role.read` |
| PUT | `/roles/:id` | Update role | Yes | `role.update` |
| DELETE | `/roles/:id` | Delete custom role | Yes | `role.delete` |
| GET | `/permissions` | List all permissions | Yes | `role.read` |
| POST | `/roles/:id/permissions` | Assign permissions to role | Yes | `role.manage` |
| DELETE | `/roles/:id/permissions/:permId` | Remove permission from role | Yes | `role.manage` |
| POST | `/users/:id/roles` | Assign role to user (scoped) | Yes | `role.manage` |
| DELETE | `/users/:id/roles/:userRoleId` | Remove role from user | Yes | `role.manage` |

### Channels
| Method | Endpoint | Description | Auth Required | Permissions |
|---|---|---|---|---|
| GET | `/channels` | List channels user can access | Yes | - |
| POST | `/channels` | Create channel | Yes | `channel.create` |
| GET | `/channels/:id` | Get channel details | Yes | Member or public channel |
| PUT | `/channels/:id` | Update channel | Yes | `channel.update` |
| DELETE | `/channels/:id` | Delete/archive channel | Yes | `channel.delete` |
| POST | `/channels/:id/join` | Join public channel | Yes | `channel.join` |
| POST | `/channels/:id/leave` | Leave channel | Yes | `channel.leave` |
| POST | `/channels/:id/invite` | Invite user to channel | Yes | `channel.invite` |
| DELETE | `/channels/:id/members/:userId` | Remove member from channel | Yes | `channel.remove_member` |
| GET | `/channels/:id/members` | List channel members | Yes | Member |
| PUT | `/channels/:id/mute` | Mute/unmute channel | Yes | Member |

### Direct Messages
| Method | Endpoint | Description | Auth Required | Permissions |
|---|---|---|---|---|
| GET | `/dms` | List all DM conversations | Yes | - |
| POST | `/dms` | Create or get DM with user | Yes | - |
| GET | `/dms/:id/messages` | Get DM messages (paginated) | Yes | Participant |
| POST | `/dms/:id/messages` | Send message in DM | Yes | Participant, `message.send` |

### Messages
| Method | Endpoint | Description | Auth Required | Permissions |
|---|---|---|---|---|
| GET | `/channels/:id/messages` | Get channel messages (paginated) | Yes | Member |
| POST | `/channels/:id/messages` | Send message in channel | Yes | Member, `message.send` |
| PUT | `/messages/:id` | Edit message | Yes | `message.edit_own` or `message.edit_any` |
| DELETE | `/messages/:id` | Delete message | Yes | `message.delete_own` or `message.delete_any` |
| POST | `/messages/:id/reply` | Reply to message (thread) | Yes | `message.reply`, `message.send` |
| POST | `/messages/:id/forward` | Forward message | Yes | `message.forward`, `message.send` |
| POST | `/messages/:id/pin` | Pin message | Yes | `message.pin` |
| DELETE | `/messages/:id/pin` | Unpin message | Yes | `message.unpin` |
| POST | `/messages/:id/star` | Star message | Yes | - |
| DELETE | `/messages/:id/star` | Unstar message | Yes | - |
| GET | `/messages/starred` | Get starred messages | Yes | - |
| POST | `/messages/:id/reactions` | Add reaction | Yes | `message.react` |
| DELETE | `/messages/:id/reactions/:emoji` | Remove reaction | Yes | - |
| GET | `/messages/:id/thread` | Get thread messages | Yes | Member/Participant |
| GET | `/messages/:id/seen-by` | Get seen by list (groups) | Yes | Member |

### Files
| Method | Endpoint | Description | Auth Required | Permissions |
|---|---|---|---|---|
| POST | `/files/upload-url` | Get presigned upload URL | Yes | `file.upload` |
| POST | `/files/confirm` | Confirm upload complete | Yes | `file.upload` |
| GET | `/files/:id` | Get file metadata | Yes | Member with access to message/channel |
| GET | `/files/:id/download` | Get signed download URL | Yes | `file.download` |
| DELETE | `/files/:id` | Delete file | Yes | `file.delete_own` or `file.delete_any` |
| GET | `/files` | List files in workspace/channel | Yes | Depends on context |

### Search
| Method | Endpoint | Description | Auth Required | Permissions |
|---|---|---|---|---|
| GET | `/search` | Global search (messages, people, channels, files) | Yes | - |
| GET | `/search/messages` | Search messages | Yes | Filtered by channel access |
| GET | `/search/users` | Search users | Yes | `user.read` |
| GET | `/search/channels` | Search channels | Yes | - |
| GET | `/search/files` | Search files | Yes | Filtered by access |

### Notifications
| Method | Endpoint | Description | Auth Required | Permissions |
|---|---|---|---|---|
| GET | `/notifications` | Get notifications | Yes | - |
| PUT | `/notifications/:id/read` | Mark notification as read | Yes | - |
| PUT | `/notifications/read-all` | Mark all as read | Yes | - |
| DELETE | `/notifications/:id` | Delete notification | Yes | - |
| GET | `/notifications/settings` | Get notification settings | Yes | - |
| PUT | `/notifications/settings` | Update notification settings | Yes | - |
| POST | `/notifications/push/subscribe` | Subscribe to web push | Yes | - |
| DELETE | `/notifications/push/unsubscribe` | Unsubscribe from web push | Yes | - |

### Admin
| Method | Endpoint | Description | Auth Required | Permissions |
|---|---|---|---|---|
| GET | `/admin/users` | Admin user management | Yes | `user.manage` |
| PUT | `/admin/users/:id/ban` | Ban user | Yes | `user.ban` |
| PUT | `/admin/users/:id/unban` | Unban user | Yes | `user.unban` |
| GET | `/admin/channels` | Manage channels | Yes | `channel.manage` |
| GET | `/admin/roles` | Manage roles | Yes | `role.manage` |
| GET | `/admin/settings` | Get workspace settings | Yes | `workspace.manage` |
| PUT | `/admin/settings` | Update workspace settings | Yes | `workspace.manage` |
| GET | `/admin/audit-logs` | View audit logs | Yes | `audit.view` |
| GET | `/admin/audit-logs/export` | Export audit logs | Yes | `audit.export` |

### Health
| Method | Endpoint | Description | Auth Required | Permissions |
|---|---|---|---|---|
| GET | `/health` | Health check endpoint | No | - |
| GET | `/health/ready` | Readiness check | No | - |

## WebSocket Events (Socket.IO)

### Connection
| Event | Direction | Description | Auth Required |
|---|---|---|---|
| `connect` | Client->Server | Establish connection | Yes (JWT in auth) |
| `disconnect` | Client->Server | Disconnect | Yes |
| `error` | Server->Client | Error event | - |

### Presence
| Event | Direction | Description | Auth Required |
|---|---|---|---|
| `presence:online` | Client->Server | User comes online | Yes |
| `presence:away` | Client->Server | User goes away | Yes |
| `presence:get` | Client->Server | Get presence for users | Yes |
| `presence:update` | Server->Client | Presence update broadcast | Yes |

### Messaging
| Event | Direction | Description | Auth Required |
|---|---|---|---|
| `chat:ready` | Server->Client | Socket access token accepted | Yes |
| `chat:join` | Client->Server | Join a channel room (`{ channelId }`) | Yes, channel access |
| `chat:leave` | Client->Server | Leave a channel room (`{ channelId }`) | Yes |
| `chat:message` | Server->Client | Persisted channel message broadcast | Yes (room member) |
| `chat:error` | Server->Client | Authentication or channel error | - |
| `message:send` | Client->Server | Send new message | Yes, `message.send` |
| `message:sent` | Server->Client | Message sent confirmation | Yes |
| `message:new` | Server->Client | New message broadcast | Yes (room member) |
| `message:edit` | Client->Server | Edit message | Yes, `message.edit_own/any` |
| `message:edited` | Server->Client | Message edited broadcast | Yes (room member) |
| `message:delete` | Client->Server | Delete message | Yes, `message.delete_own/any` |
| `message:deleted` | Server->Client | Message deleted broadcast | Yes (room member) |
| `message:reply` | Client->Server | Reply to message | Yes, `message.reply` |
| `message:forward` | Client->Server | Forward message | Yes, `message.forward` |
| `message:pin` | Client->Server | Pin message | Yes, `message.pin` |
| `message:unpinned` | Server->Client | Message pinned/unpinned broadcast | Yes (room member) |
| `message:reaction` | Client->Server | Add/remove reaction | Yes, `message.react` |
| `message:reaction:update` | Server->Client | Reaction update broadcast | Yes (room member) |

### Typing
| Event | Direction | Description | Auth Required |
|---|---|---|---|
| `typing:start` | Client->Server | Start typing indicator | Yes |
| `typing:stop` | Client->Server | Stop typing indicator | Yes |
| `typing:update` | Server->Client | Typing status broadcast | Yes (room member) |

### Message Status
| Event | Direction | Description | Auth Required |
|---|---|---|---|
| `message:delivered` | Client->Server | Mark message as delivered | Yes |
| `message:read` | Client->Server | Mark message as read | Yes |
| `message:status:update` | Server->Client | Status update (sent/delivered/read) | Yes |
| `message:seen-by` | Server->Client | Seen by list update for group messages | Yes (admin setting dependent) |

### Channels/DMs
| Event | Direction | Description | Auth Required |
|---|---|---|---|
| `channel:join` | Client->Server | Join channel room | Yes |
| `channel:leave` | Client->Server | Leave channel room | Yes |
| `channel:update` | Server->Client | Channel updated broadcast | Yes (member) |
| `dm:join` | Client->Server | Join DM room | Yes (participant) |

### Notifications
| Event | Direction | Description | Auth Required |
|---|---|---|---|
| `notification:new` | Server->Client | New notification | Yes |
| `unread:update` | Server->Client | Unread count update | Yes |

## Notes
- All REST endpoints require authentication unless explicitly marked "No"
- All WebSocket events are authorized server-side
- Permission checks are enforced on both REST and WebSocket
- UI permission hiding is purely for UX
- Search results are filtered by channel/DM access
- Read receipts respect admin setting `show_read_receipts` in groups
