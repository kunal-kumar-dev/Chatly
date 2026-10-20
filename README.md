# Chatly

A secure company team-chat application with role-based access control. The
current MVP includes email/password authentication, workspace channels,
persistent message history, and authenticated real-time chat. File sharing,
direct messages, and server-side search remain planned work.

## What works today

### Implemented
- Email/password registration and sign-in, Argon2 password hashes, JWT access
  tokens, rotating refresh tokens, session restore, and sign-out.
- Seeded demo workspace, workspace membership, system roles, and server-side
  permission guards.
- Public workspace channels and access checks for private channels a user
  already belongs to. Private-channel administration is not implemented.
- Persistent channel messages, loading the latest 100 messages, and live
  delivery to authenticated Socket.IO clients in the same channel.
- Channel member list, channel details, in-channel filtering of the messages
  already loaded, and channel links that open the selected channel.
- PostgreSQL readiness endpoint at `/api/health/ready`.

### Not implemented yet
- Direct or group messages, private-channel creation and membership controls.
- File uploads, server-side/full-history search, typing or online presence,
  read receipts, notifications, and the admin UI.
- Message editing/deletion, pagination beyond the latest 100 messages, and
  other unlisted roadmap items.

The UI's message filter only searches messages currently loaded in the selected
channel; it is not a server-side search. See the [roadmap](docs/roadmap.md) for
planned work.

## Tech Stack
- **Frontend**: Next.js 14+ (App Router), React, TypeScript, Tailwind CSS
- **Backend**: NestJS, TypeScript, REST API + Socket.IO
- **Database**: PostgreSQL with Prisma
- **Redis and MinIO**: available in the development stack; presence, caching,
  and file uploads are not integrated into the current MVP
- **Monorepo**: pnpm workspaces

## Quick Start

### Prerequisites
- Node.js 18+
- pnpm 8+
- Docker with the Docker Compose plugin

### Setup

1. Install dependencies:
```bash
pnpm install
```

2. Create the root environment file:
```bash
cp .env.example .env
```

For local development, `DATABASE_URL` must contain credentials for the
PostgreSQL server reachable at `localhost:5432`. For Docker Compose, the
`CHATLY_DB_USER` and `CHATLY_DB_PASSWORD` values configure both PostgreSQL and
the API connection; keep them consistent with `DATABASE_URL` for commands run
from the host.

3. Start PostgreSQL, Redis, and MinIO:
```bash
docker compose up -d postgres redis minio
```

4. Generate the Prisma client, apply the schema, and seed demo data:
```bash
pnpm db:generate
pnpm db:push
pnpm db:seed
```

5. Start the development servers:
```bash
pnpm dev
```

- API: http://localhost:3001
- Web: http://localhost:3000
- MinIO Console: http://localhost:9001 (minioadmin/minioadmin)
- Demo sign-in after seeding: `member@chatly.local` / `password123`

If PostgreSQL is already installed on the host, it must accept the username
and password in `DATABASE_URL`; having port 5432 open alone does not confirm
that the credentials work.

For a fresh Docker database, Compose initializes the configured role and
password when it first creates its data volume. Changing `.env` later does not
change credentials inside an existing PostgreSQL volume; update the database
role using a PostgreSQL administrator if needed. Do not remove the volume
unless you intend to delete its data.

REST requests and Socket.IO connections require a valid access token. The
browser stores access and refresh tokens in session storage; refresh tokens
are rotated by the API.

For a separate web/API deployment, set `NEXT_PUBLIC_API_URL` in `.env` to the
browser-accessible API base URL (for example, `https://chat-api.example.com/api`)
before building the web app or running `docker compose up --build`.

## Test stack with Docker

For a containerized stack, create `.env` from `.env.example` and replace both
JWT secrets with unique values of at least 32 characters. Then run:

```bash
docker compose up --build
```

This starts the API, web app, PostgreSQL, Redis, and MinIO. The API is
available at `http://localhost:3001/api` and its unauthenticated health check
is `http://localhost:3001/api/health`.

## Project Structure

See [docs/architecture/project-structure.md](docs/architecture/project-structure.md) for detailed structure.

## Development

### Database
- Generate Prisma client: `pnpm db:generate`
- Create migration: `pnpm db:migrate`
- Push schema: `pnpm db:push` 
- Seed database: `pnpm db:seed`

### Testing
- Run all tests: `pnpm test`
- Integration tests: See `tests/integration/`
- Security/RBAC tests: See `tests/security/`

### Adding Permissions
1. Add permission to `packages/authorization/src/permissions.ts`
2. Update seed data in `packages/database/prisma/seed.ts`
3. Use `@RequirePermissions()` decorator in API endpoints

### Adding Roles
Roles are stored in the database and system roles are created by the seed
script. Custom role-management endpoints and an admin UI are not implemented.

## Phase Status

- [x] Authentication foundation, workspace membership, seeded roles, and
  server-side permission guards
- [ ] User/role/permission management endpoints and admin UI
- [x] Phase 2 MVP: Public workspace channels and authenticated real-time messages
- [ ] Phase 2 remaining: DMs, private-channel administration, message status
- [ ] Phase 3: File sharing, search
- [ ] Phase 4: Notifications, admin panel, audit logs
- [ ] Phase 5: Polish, performance, deployment

## Documentation
- [Architecture](docs/architecture/overview.md)
- [Database Schema](docs/schema/database-schema.md)
- [API Specification](docs/api/api-spec.md)
- [Roadmap](docs/roadmap.md)
