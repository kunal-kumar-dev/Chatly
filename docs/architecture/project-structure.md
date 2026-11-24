# Chatly Project Structure

Chatly is a pnpm workspace monorepo. The runnable applications live under
`apps/`, and reusable workspace packages live under `packages/`.

```text
chatly/
├── apps/
│   ├── api/                         # NestJS REST API and Socket.IO gateway
│   │   └── src/
│   │       ├── audit/               # Audit-related API module
│   │       ├── auth/                # Registration, login, refresh, logout
│   │       ├── chat/                # Channels, direct messages, messaging
│   │       ├── common/              # Shared decorators and guards
│   │       ├── config/              # Environment loading
│   │       ├── health/              # API and database health checks
│   │       ├── memberships/         # Workspace and channel membership
│   │       ├── permissions/         # Permission-related API module
│   │       ├── rbac/                # Permission decorator and guard
│   │       ├── roles/               # Role-related API module
│   │       ├── users/               # User-related API module
│   │       ├── workspaces/          # Workspace-related API module
│   │       ├── app.module.ts
│   │       └── main.ts
│   └── web/                         # Next.js web application
│       ├── app/                     # App Router, chat page, global styles
│       ├── components/              # Shared UI components
│       ├── features/                # Feature-specific UI code
│       └── lib/                     # Frontend utilities
├── packages/
│   ├── authorization/               # Shared permission definitions
│   ├── config/                      # Shared configuration package
│   ├── contracts/                   # Shared application contracts
│   └── database/                    # Prisma client, schema, and seed
│       └── prisma/
├── docs/
│   ├── api/                         # API specification
│   ├── architecture/                # Architecture and design notes
│   ├── images/                      # Documentation images
│   └── schema/                      # Database schema documentation
├── scripts/                         # Repository utility scripts
├── tests/                           # Cross-package tests, when present
├── docker-compose.yml               # Local development services
├── package.json                     # Root scripts and workspace config
├── pnpm-lock.yaml
└── pnpm-workspace.yaml
```

## Application responsibilities

### API (`apps/api`)

- **Auth**: Email/password registration and login, JWT access tokens, and
  rotating refresh tokens.
- **Chat**: Workspace channels, one-to-one direct conversations, message
  history, and message creation.
- **Common**: HTTP authentication and public-route decorators.
- **Health**: API availability and PostgreSQL readiness endpoints.
- **RBAC**: Permission metadata and server-side permission checks.
- **Gateway**: Authenticated Socket.IO connections and real-time chat events.

Unit tests are colocated with the API modules as `*.spec.ts` files. API
configuration, Jest, and Docker files are in `apps/api/`.

### Web (`apps/web`)

- **App Router**: The chat interface and shared application layout.
- **Components and features**: Reusable UI and feature-specific presentation.
- **Library code**: Frontend helpers and API integrations.

The web app is built with Next.js, React, and TypeScript.

## Shared packages

- **Authorization** provides permission names shared across services.
- **Database** owns the Prisma schema, generated client, and development seed.
- **Config** and **contracts** contain shared configuration and interface
  definitions for workspace consumers.

## Development

Install dependencies from the repository root with `pnpm install`. Common
workspace commands are defined in the root `package.json`:

```bash
pnpm dev
pnpm -r build
pnpm -r typecheck
pnpm -r lint
pnpm --filter @chatly/api test
```

See the root [README](../../README.md) for setup instructions and implemented
features. The [architecture overview](./overview.md) and [roadmap](../roadmap.md)
describe system design and planned work.
