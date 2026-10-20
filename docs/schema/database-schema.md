# Chatly Database Schema

## Design Principles
- RBAC with permissions stored in DB (never hardcoded)
- Scope-based permissions (workspace, team, channel)
- Audit logging for all sensitive actions
- Soft deletes where appropriate (deleted_at)
- Proper indexes for performance (messages, search, unread counts)
- Extensible design (SSO ready, Meilisearch migration ready)

## Core Tables

### Workspaces
Represents a company/workspace.

```sql
Table workspaces {
  id UUID [pk, default: gen_random_uuid()]
  name VARCHAR(100) [not null]
  slug VARCHAR(100) [unique, not null]
  logo_url TEXT
  created_at TIMESTAMPTZ [not null, default: now()]
  updated_at TIMESTAMPTZ [not null, default: now()]
  deleted_at TIMESTAMPTZ
}
```

### Users
User accounts with profile information.

```sql
Table users {
  id UUID [pk, default: gen_random_uuid()]
  email VARCHAR(255) [unique, not null]
  password_hash VARCHAR(255) [not null]
  first_name VARCHAR(50) [not null]
  last_name VARCHAR(50) [not null]
  display_name VARCHAR(100)
  avatar_url TEXT
  status_message VARCHAR(200)
  timezone VARCHAR(100) [default: 'UTC']
  is_active BOOLEAN [not null, default: true]
  is_email_verified BOOLEAN [not null, default: false]
  last_seen_at TIMESTAMPTZ
  last_login_at TIMESTAMPTZ
  created_at TIMESTAMPTZ [not null, default: now()]
  updated_at TIMESTAMPTZ [not null, default: now()]
  deleted_at TIMESTAMPTZ
}
```

### Permissions
System-defined permissions (not hardcoded in code).

```sql
Table permissions {
  id UUID [pk, default: gen_random_uuid()]
  name VARCHAR(100) [unique, not null]
  description TEXT
  resource VARCHAR(50) [not null]  // e.g., 'channel', 'message', 'user', 'file', 'role', 'audit', 'export'
  action VARCHAR(50) [not null]    // e.g., 'create', 'read', 'update', 'delete', 'manage', 'invite', 'remove_member', 'view', 'pin', 'export'
  created_at TIMESTAMPTZ [not null, default: now()]
  updated_at TIMESTAMPTZ [not null, default: now()]
  
  indexes {
    (resource, action)
  }
}
```

### Roles
Roles can be system defaults or custom (created by Super Admin).

```sql
Table roles {
  id UUID [pk, default: gen_random_uuid()]
  name VARCHAR(50) [unique, not null]
  description TEXT
  is_system BOOLEAN [not null, default: false]  // System roles cannot be deleted
  is_custom BOOLEAN [not null, default: false]  // Created by admin
  created_at TIMESTAMPTZ [not null, default: now()]
  updated_at TIMESTAMPTZ [not null, default: now()]
  deleted_at TIMESTAMPTZ
}
```

### Role Permissions
Maps permissions to roles.

```sql
Table role_permissions {
  id UUID [pk, default: gen_random_uuid()]
  role_id UUID [not null, ref: roles.id]
  permission_id UUID [not null, ref: permissions.id]
  created_at TIMESTAMPTZ [not null, default: now()]
  
  indexes {
    (role_id, permission_id) [unique]
  }
}
```

### User Roles (Scoped RBAC)
Users can have different roles in different scopes (workspace/team/channel).

```sql
Table user_roles {
  id UUID [pk, default: gen_random_uuid()]
  user_id UUID [not null, ref: users.id]
  role_id UUID [not null, ref: roles.id]
  scope_type VARCHAR(20) [not null]  // 'workspace', 'team', 'channel'
  scope_id UUID [not null]           // ID of workspace/team/channel
  created_at TIMESTAMPTZ [not null, default: now()]
  updated_at TIMESTAMPTZ [not null, default: now()]
  
  indexes {
    (user_id, scope_type, scope_id)
    (scope_type, scope_id)
  }
}
```

### Teams (Optional grouping within workspace)

```sql
Table teams {
  id UUID [pk, default: gen_random_uuid()]
  workspace_id UUID [not null, ref: workspaces.id]
  name VARCHAR(100) [not null]
  description TEXT
  is_private BOOLEAN [not null, default: false]
  created_by UUID [ref: users.id]
  created_at TIMESTAMPTZ [not null, default: now()]
  updated_at TIMESTAMPTZ [not null, default: now()]
  deleted_at TIMESTAMPTZ
  
  indexes {
    (workspace_id)
  }
}
```

## Channels & Messaging

### Channels
Channels for group communication.

```sql
Table channels {
  id UUID [pk, default: gen_random_uuid()]
  workspace_id UUID [not null, ref: workspaces.id]
  team_id UUID [ref: teams.id]
  name VARCHAR(100) [not null]
  description TEXT
  type VARCHAR(20) [not null]  // 'public', 'private'
  is_archived BOOLEAN [not null, default: false]
  created_by UUID [ref: users.id]
  created_at TIMESTAMPTZ [not null, default: now()]
  updated_at TIMESTAMPTZ [not null, default: now()]
  deleted_at TIMESTAMPTZ
  
  indexes {
    (workspace_id, type)
    (workspace_id, is_archived)
  }
}
```

### Channel Members
Tracks membership in channels.

```sql
Table channel_members {
  id UUID [pk, default: gen_random_uuid()]
  channel_id UUID [not null, ref: channels.id]
  user_id UUID [not null, ref: users.id]
  joined_at TIMESTAMPTZ [not null, default: now()]
  last_read_at TIMESTAMPTZ
  is_muted BOOLEAN [not null, default: false]
  muted_until TIMESTAMPTZ
  
  indexes {
    (channel_id, user_id) [unique]
    (user_id, channel_id)
  }
}
```

### Direct Messages (DMs)
One-to-one conversations between two members of a shared workspace. Group
conversations use channels.

```sql
Table dms {
  id UUID [pk, default: gen_random_uuid()]
  workspace_id UUID [not null, ref: workspaces.id]
  user1_id UUID [not null, ref: users.id]
  user2_id UUID [not null, ref: users.id]
  created_at TIMESTAMPTZ [not null, default: now()]
  updated_at TIMESTAMPTZ [not null, default: now()]
  
  indexes {
    (workspace_id)
    (user1_id, user2_id) [unique]
  }
}
```

### Messages
Core messaging table.

```sql
Table messages {
  id UUID [pk, default: gen_random_uuid()]
  workspace_id UUID [not null, ref: workspaces.id]
  channel_id UUID [ref: channels.id]  // null for DMs
  dm_id UUID [ref: dms.id]            // null for channel messages
  sender_id UUID [not null, ref: users.id]
  parent_message_id UUID [ref: messages.id]  // for threads/replies
  content TEXT
  type VARCHAR(20) [not null, default: 'text']  // 'text', 'file', 'system'
  is_edited BOOLEAN [not null, default: false]
  edited_at TIMESTAMPTZ
  is_deleted BOOLEAN [not null, default: false]  // soft delete
  deleted_at TIMESTAMPTZ
  deleted_by UUID [ref: users.id]  // who deleted (self or admin)
  delete_scope VARCHAR(20)         // 'for_me', 'for_everyone'
  is_pinned BOOLEAN [not null, default: false]
  pinned_at TIMESTAMPTZ
  pinned_by UUID [ref: users.id]
  is_forwarded BOOLEAN [not null, default: false]
  forwarded_from_message_id UUID [ref: messages.id]
  created_at TIMESTAMPTZ [not null, default: now()]
  updated_at TIMESTAMPTZ [not null, default: now()]
  
  indexes {
    (channel_id, created_at DESC)
    (dm_id, created_at DESC)
    (workspace_id, created_at DESC)
    (parent_message_id, created_at)
    (is_pinned, channel_id) where is_pinned = true
    (is_deleted)
  }
}
```

### Message Status (Delivery/Read receipts)
Tracks message delivery and read status per recipient.

```sql
Table message_status {
  id UUID [pk, default: gen_random_uuid()]
  message_id UUID [not null, ref: messages.id]
  recipient_id UUID [not null, ref: users.id]
  status VARCHAR(20) [not null]  // 'sent', 'delivered', 'read'
  delivered_at TIMESTAMPTZ
  read_at TIMESTAMPTZ
  
  indexes {
    (message_id, recipient_id) [unique]
    (recipient_id, status)
    (recipient_id, read_at) where read_at is null
  }
}
```

### Message Reactions
Emoji reactions to messages.

```sql
Table message_reactions {
  id UUID [pk, default: gen_random_uuid()]
  message_id UUID [not null, ref: messages.id]
  user_id UUID [not null, ref: users.id]
  emoji VARCHAR(50) [not null]
  created_at TIMESTAMPTZ [not null, default: now()]
  
  indexes {
    (message_id, emoji)
    (message_id, user_id, emoji) [unique]
  }
}
```

### Message Stars
Starred messages for user reference.

```sql
Table message_stars {
  id UUID [pk, default: gen_random_uuid()]
  message_id UUID [not null, ref: messages.id]
  user_id UUID [not null, ref: users.id]
  created_at TIMESTAMPTZ [not null, default: now()]
  
  indexes {
    (message_id, user_id) [unique]
    (user_id, created_at DESC)
  }
}
```

### Mentions
Tracks @mentions in messages.

```sql
Table mentions {
  id UUID [pk, default: gen_random_uuid()]
  message_id UUID [not null, ref: messages.id]
  mentioned_user_id UUID [not null, ref: users.id]
  created_at TIMESTAMPTZ [not null, default: now()]
  
  indexes {
    (mentioned_user_id, created_at DESC)
    (message_id)
  }
}
```

## Files

### Files
File metadata.

```sql
Table files {
  id UUID [pk, default: gen_random_uuid()]
  workspace_id UUID [not null, ref: workspaces.id]
  uploader_id UUID [not null, ref: users.id]
  message_id UUID [ref: messages.id]
  original_name VARCHAR(255) [not null]
  filename VARCHAR(255) [not null]  // stored filename
  mime_type VARCHAR(100) [not null]
  file_size BIGINT [not null]
  file_type VARCHAR(50) [not null]  // 'image', 'pdf', 'document', 'zip', 'other'
  s3_key VARCHAR(500) [not null]
  s3_bucket VARCHAR(255) [not null]
  thumbnail_key VARCHAR(500)
  thumbnail_url TEXT
  is_scanned BOOLEAN [not null, default: false]
  scan_status VARCHAR(20) [default: 'pending']  // 'pending', 'clean', 'infected', 'failed'
  virus_name VARCHAR(255)
  download_count INT [not null, default: 0]
  is_deleted BOOLEAN [not null, default: false]
  deleted_at TIMESTAMPTZ
  created_at TIMESTAMPTZ [not null, default: now()]
  updated_at TIMESTAMPTZ [not null, default: now()]
  
  indexes {
    (workspace_id, created_at DESC)
    (message_id)
    (uploader_id)
    (is_deleted)
  }
}
```

## Search

### Search Index (Notes)
PostgreSQL full-text search is used first. We'll add tsvector columns for efficient searching.

```sql
Table message_search {
  message_id UUID [pk, ref: messages.id]
  tsvector TSVECTOR
  created_at TIMESTAMPTZ [not null]
  
  indexes {
    tsvector using gin(tsvector)
    (message_id)
  }
}
```

Full-text search will cover: message content. For future Meilisearch, document structure will mirror this with permission filtering.

## Notifications

### Notifications
In-app and system notifications.

```sql
Table notifications {
  id UUID [pk, default: gen_random_uuid()]
  workspace_id UUID [not null, ref: workspaces.id]
  user_id UUID [not null, ref: users.id]
  type VARCHAR(50) [not null]  // 'mention', 'dm', 'reply', 'channel_invite', 'role_change', etc.
  title VARCHAR(255) [not null]
  content TEXT
  data JSONB  // additional context
  is_read BOOLEAN [not null, default: false]
  read_at TIMESTAMPTZ
  action_url TEXT
  created_at TIMESTAMPTZ [not null, default: now()]
  updated_at TIMESTAMPTZ [not null, default: now()]
  
  indexes {
    (user_id, is_read, created_at DESC)
    (user_id, created_at DESC)
  }
}
```

### User Notification Settings
Per-user notification preferences.

```sql
Table notification_settings {
  id UUID [pk, default: gen_random_uuid()]
  user_id UUID [not null, ref: users.id] [unique]
  email_mentions BOOLEAN [not null, default: true]
  email_dms BOOLEAN [not null, default: true]
  email_digest_enabled BOOLEAN [not null, default: true]
  email_digest_frequency VARCHAR(20) [default: 'daily']  // 'hourly', 'daily', 'weekly'
  web_push_enabled BOOLEAN [not null, default: true]
  web_push_mentions BOOLEAN [not null, default: true]
  web_push_dms BOOLEAN [not null, default: true]
  created_at TIMESTAMPTZ [not null, default: now()]
  updated_at TIMESTAMPTZ [not null, default: now()]
}
```

### Web Push Subscriptions
For web push notifications.

```sql
Table push_subscriptions {
  id UUID [pk, default: gen_random_uuid()]
  user_id UUID [not null, ref: users.id]
  endpoint TEXT [not null]
  p256dh VARCHAR(255) [not null]
  auth VARCHAR(255) [not null]
  created_at TIMESTAMPTZ [not null, default: now()]
  updated_at TIMESTAMPTZ [not null, default: now()]
  
  indexes {
    (user_id)
  }
}
```

### Channel Mute Settings
Already in channel_members (is_muted, muted_until). Additional granular controls if needed.

## Admin, Settings & Audit

### Workspace Settings
Configurable workspace policies.

```sql
Table workspace_settings {
  id UUID [pk, default: gen_random_uuid()]
  workspace_id UUID [not null, ref: workspaces.id] [unique]
  allow_guest_read_only BOOLEAN [not null, default: true]
  show_read_receipts BOOLEAN [not null, default: true]  // Admin setting for groups
  max_file_size_mb INT [not null, default: 50]
  allowed_file_types JSONB  // e.g., ["image/*", "application/pdf", ".docx", ".zip"]
  message_retention_days INT
  file_retention_days INT
  enable_virus_scan BOOLEAN [not null, default: false]
  created_at TIMESTAMPTZ [not null, default: now()]
  updated_at TIMESTAMPTZ [not null, default: now()]
}
```

### Audit Logs
Critical for security and compliance.

```sql
Table audit_logs {
  id UUID [pk, default: gen_random_uuid()]
  workspace_id UUID [not null, ref: workspaces.id]
  user_id UUID [ref: users.id]  // who performed action (null for system)
  action VARCHAR(100) [not null]  // e.g., 'user.create', 'role.update', 'message.delete', 'login.success', 'export.data'
  resource_type VARCHAR(50) [not null]  // 'user', 'role', 'channel', 'message', 'file'
  resource_id UUID
  details JSONB  // action details, before/after values
  ip_address VARCHAR(45)
  user_agent TEXT
  created_at TIMESTAMPTZ [not null, default: now()]
  
  indexes {
    (workspace_id, created_at DESC)
    (user_id, created_at DESC)
    (action, created_at DESC)
    (resource_type, resource_id)
  }
}
```

### Refresh Tokens
For secure token rotation.

```sql
Table refresh_tokens {
  id UUID [pk, default: gen_random_uuid()]
  user_id UUID [not null, ref: users.id]
  token_hash VARCHAR(255) [not null, unique]
  expires_at TIMESTAMPTZ [not null]
  revoked_at TIMESTAMPTZ
  created_at TIMESTAMPTZ [not null, default: now()]
  created_by_ip VARCHAR(45)
  
  indexes {
    (user_id)
    (token_hash)
    (expires_at)
  }
}
```

## Auth Sessions (optional, for device tracking)

```sql
Table auth_sessions {
  id UUID [pk, default: gen_random_uuid()]
  user_id UUID [not null, ref: users.id]
  user_agent TEXT
  ip_address VARCHAR(45)
  expires_at TIMESTAMPTZ [not null]
  created_at TIMESTAMPTZ [not null, default: now()]
  revoked_at TIMESTAMPTZ
  last_activity_at TIMESTAMPTZ [not null, default: now()]
  
  indexes {
    (user_id)
    (expires_at)
  }
}
```

## Default Roles & Permissions (Seed Data)

### Default System Roles
1. **Super Admin** - Full system access, can manage everything including custom roles
2. **Admin** - Manage users, channels, settings (cannot manage roles unless granted)
3. **Manager** - Manage team/channel members, moderate content
4. **Member** - Standard user, can send messages, upload files
5. **Guest** - Limited, read-only by default

### Core Permission Set
Key permissions as specified:
- `channel.create`, `channel.read`, `channel.update`, `channel.delete`, `channel.invite`, `channel.remove_member`, `channel.join`, `channel.leave`, `channel.manage`
- `message.send`, `message.read`, `message.edit_own`, `message.edit_any`, `message.delete_own`, `message.delete_any`, `message.reply`, `message.forward`, `message.pin`, `message.unpin`, `message.star`, `message.react`, `message.mention`
- `file.upload`, `file.download`, `file.delete_own`, `file.delete_any`
- `user.create`, `user.read`, `user.update`, `user.delete`, `user.manage`, `user.ban`, `user.unban`
- `role.create`, `role.read`, `role.update`, `role.delete`, `role.manage`
- `audit.view`, `audit.export`
- `export.data`, `workspace.manage`, `team.manage`

## Indexing Notes for Performance
- Messages: Composite indexes on (channel_id, created_at DESC) for infinite scroll
- Unread counts: message_status with (recipient_id, read_at) where null
- Search: GIN index on tsvector for full-text search
- Mentions/notifications: Optimized for user queries
- Presence: Handled in Redis (not in PG)
