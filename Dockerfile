# syntax=docker/dockerfile:1

# Shared base with pnpm via corepack. Bookworm (glibc) keeps argon2 and
# Prisma prebuilt binaries working on both amd64 and arm64.
FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1 \
    TURBO_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# Install all workspace dependencies against the committed lockfile.
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/backup/package.json packages/backup/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Build every workspace package (domain, database client, api, worker, web).
FROM deps AS build
COPY . .
RUN pnpm build

# --- Runtime: API ---
FROM base AS api
ENV NODE_ENV=production PORT=3001
COPY --from=build /app /app
WORKDIR /app/apps/api
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]

# --- Runtime: Worker ---
FROM base AS worker
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/worker
USER node
CMD ["node", "dist/main.js"]

# --- Runtime: Web ---
FROM base AS web
ENV NODE_ENV=production PORT=3000
COPY --from=build /app /app
WORKDIR /app/apps/web
USER node
EXPOSE 3000
CMD ["pnpm", "start"]

# --- Runtime: Backup (encrypted pg_dump -> object storage) ---
# Bundles postgresql-client-17 so pg_dump matches the Postgres 17 server.
FROM base AS backup
ENV NODE_ENV=production
USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
    && install -d /usr/share/postgresql-common/pgdg \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
       -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
    && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
       > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client-17 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app /app
WORKDIR /app
USER node
# Defaults to an object-storage backup; override the command for restores.
CMD ["node", "packages/backup/bin/backup.mjs", "--s3"]
