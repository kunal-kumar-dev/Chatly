FROM node:20-bookworm-slim

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/authorization/package.json packages/authorization/package.json
COPY packages/database/package.json packages/database/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @chatly/database prisma:generate \
  && pnpm --filter @chatly/authorization build \
  && pnpm --filter @chatly/database build \
  && pnpm --filter @chatly/api build

EXPOSE 3001
CMD ["pnpm", "--filter", "@chatly/api", "start:prod"]
