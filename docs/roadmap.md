# Chatly Roadmap

## Phase 1: Auth, users, workspace, roles and permissions ✅
- [x] Architecture overview and database schema
- [x] Monorepo setup with pnpm workspaces
- [x] Prisma schema with RBAC (permissions, roles, user_roles with scope)
- [x] Permission system stored in DB (not hardcoded)
- [x] Auth system (email/password, JWT access + refresh tokens)
- [x] Password hashing with argon2
- [x] RBAC guards and decorators for server-side enforcement
- [x] Seed data (default roles, permissions, demo workspace, users)
- [ ] REST endpoints for auth, users, roles, permissions
- [ ] Tests for permission logic and auth flows

## Phase 2: Channels, DMs, real-time messaging, message status ticks
- [x] Public workspace channels and channel member listing
- [x] Group conversations through channels
- [ ] Private channel management and membership administration
- [x] One-to-one direct messages between active members of a shared workspace
- [x] Authenticated Socket.IO gateway with channel and participant-authorized DM rooms
- [x] Persistent channel and direct messages with real-time delivery
- [x] Chat UI sign-in, group and DM history, search, member list, and conversation options
- [ ] Typing indicators
- [ ] Online/offline presence (Redis)
- [ ] Message status ticks (sent/delivered/read)
- [ ] Group read receipts with "Seen by"
- [ ] Admin setting for read receipts visibility

## Phase 3: File and image sharing, search
- [ ] File upload to S3/MinIO with presigned URLs
- [ ] Image thumbnails and preview
- [ ] Upload progress, drag-and-drop, paste
- [ ] File type allowlist and size limits
- [ ] Virus scanning hook (ClamAV)
- [ ] Signed expiring download URLs
- [ ] PostgreSQL full-text search
- [ ] Search messages, people, channels, files
- [ ] Search filters and permission filtering
- [ ] Meilisearch migration path

## Phase 4: Notifications, admin panel, audit logs
- [ ] Unread counts and mention notifications
- [ ] Mute channel functionality
- [ ] Web push notifications
- [ ] Email digest for missed messages
- [ ] Admin panel (users, roles, channels, file policies, retention)
- [ ] Audit logs for sensitive actions
- [ ] Message history with infinite scroll
- [ ] Jump-to-unread marker
- [ ] Message actions (reply, edit, delete, forward, pin, star, reactions, @mentions, threads)

## Phase 5: Polish, performance, deployment
- [ ] Unit tests for permission logic
- [ ] Integration tests for main flows
- [ ] Security tests (Guest cannot post, Member cannot delete others' messages, private channel access)
- [ ] Light/dark mode
- [ ] Keyboard shortcuts
- [ ] Accessibility (ARIA, focus states)
- [ ] Performance optimization
- [ ] Structured logging
- [ ] Deployment documentation
- [ ] Production Docker setup

## Phase 6: Voice/video calls and screen sharing
- [ ] One-to-one voice and video calls using WebRTC
- [ ] Screen sharing during calls
- [ ] Call controls (mute, camera, and end call)

## Future Phases
- **Mobile app**: React Native
- **SSO**: Google/Microsoft OIDC integration
- **Message retention and export**: Automated retention policies and data export
- **Bots and integrations**: Bot framework and webhook support
- **End-to-end encryption**: For DMs (v2)
- **Meilisearch**: Full migration from PostgreSQL search
