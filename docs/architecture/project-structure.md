# Chatly Project Structure

```
chatly/
├── docker-compose.yml          # Dev environment (Postgres, Redis, MinIO, app)
├── docker-compose.prod.yml     # Production setup
├── .env.example               # Environment variables template
├── README.md                  # Setup instructions
├── package.json               # Root workspace config (optional monorepo)
│
├── docs/                      # Documentation
│   ├── architecture/
│   │   └── overview.md
│   ├── schema/
│   │   └── database-schema.md
│   ├── api/
│   │   └── api-spec.md
│   ├── diagrams/             # Architecture diagrams
│   └── roadmap.md
│
├── backend/                   # NestJS Backend
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── nest-cli.json
│   ├── .env.example
│   ├── prisma/               # Prisma schema & migrations (if using Prisma)
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── common/           # Shared utilities
│   │   │   ├── decorators/   # Custom decorators (@Permissions, @GetUser)
│   │   │   ├── guards/       # Auth, Permissions guards
│   │   │   ├── filters/      # Exception filters
│   │   │   ├── interceptors/ # Logging, transform
│   │   │   ├── pipes/        # Validation pipes
│   │   │   └── dto/          # Common DTOs
│   │   ├── config/           # Configuration
│   │   │   ├── database.config.ts
│   │   │   ├── redis.config.ts
│   │   │   ├── jwt.config.ts
│   │   │   └── s3.config.ts
│   │   ├── auth/             # Authentication module
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/   # JWT strategies
│   │   │   └── dto/
│   │   ├── users/            # Users module
│   │   ├── rbac/             # RBAC module (roles, permissions)
│   │   │   ├── rbac.module.ts
│   │   │   ├── rbac.service.ts
│   │   │   ├── guards/       # Permissions guard
│   │   │   └── decorators/   # Permissions decorator
│   │   ├── workspaces/       # Workspaces module
│   │   ├── channels/         # Channels module
│   │   ├── messages/         # Messages module
│   │   ├── files/            # File upload/download
│   │   ├── search/           # Search service
│   │   ├── notifications/    # Notifications
│   │   ├── presence/         # Presence tracking
│   │   ├── gateway/          # WebSocket gateway
│   │   │   └── chat.gateway.ts
│   │   ├── admin/            # Admin panel
│   │   ├── audit/            # Audit logging
│   │   └── health/           # Health check
│   ├── test/                 # E2E tests
│   └── __tests__/            # Unit tests
│
├── frontend/                  # Next.js Frontend
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.js
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   ├── public/
│   │   ├── logo.svg
│   │   └── icons/
│   ├── src/
│   │   ├── app/              # Next.js App Router
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── (auth)/       # Auth pages
│   │   │   ├── (app)/        # Main app pages
│   │   │   └── globals.css
│   │   ├── components/       # React components
│   │   │   ├── ui/           # UI components (shadcn/ui style)
│   │   │   ├── layout/       # Layout components
│   │   │   ├── chat/         # Chat components
│   │   │   ├── sidebar/      # Sidebar components
│   │   │   └── admin/        # Admin panel components
│   │   ├── lib/              # Utilities
│   │   │   ├── api.ts        # API client
│   │   │   ├── socket.ts     # Socket.IO client
│   │   │   ├── auth.ts       # Auth utilities
│   │   │   └── utils.ts
│   │   ├── hooks/            # Custom React hooks
│   │   ├── store/            # State management (Zustand/Redux)
│   │   ├── types/            # TypeScript types
│   │   └── styles/           # Styles
│   └── __tests__/            # Frontend tests
│
└── scripts/                   # Utility scripts
    ├── setup.sh
    └── seed-dev.sh
```

## Module Responsibilities

### Backend Modules
- **Auth**: Registration, login, JWT tokens, password hashing, refresh tokens
- **RBAC**: Permission checking, role management, scoped permissions
- **Users**: User profiles, status, presence
- **Workspaces/Teams**: Workspace and team management
- **Channels**: Public/private channels, membership
- **Messages**: CRUD, threads, reactions, pins, stars, forwarding
- **Gateway**: WebSocket events, real-time communication
- **Files**: Upload, download, validation, thumbnails
- **Search**: Full-text search with permission filtering
- **Notifications**: In-app, push, email
- **Presence**: Online status tracking via Redis
- **Admin**: Admin panel functionality
- **Audit**: Audit logging
- **Health**: Health checks

### Frontend Structure
- **App Router**: Next.js 14+ with app directory
- **Layout**: Main app layout with sidebar and chat area
- **Components**: Modular, reusable components
- **State**: Server state (React Query) + client state (Zustand)
- **Real-time**: Socket.IO client integration
- **Auth**: JWT token management
