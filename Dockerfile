# syntax = docker/dockerfile:1

# The server image. Node runs src/*.ts directly, so there is no build step.
# It serves HTTP on 0.0.0.0:$PORT (fly.toml sets PORT), keeps its database in
# /data (the volume) and publishes README.md at /readme/ (spec/README.md says
# what's checked).

# Production dependencies only, from the lockfile. pnpm comes from npm at the
# exact version in mise.toml: corepack would need a packageManager field and
# is no longer bundled from Node 25.
FROM node:24.21.0-slim AS deps
WORKDIR /app
RUN npm install -g pnpm@11.9.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM node:24.21.0-slim
WORKDIR /app
# the machine has 256 MB
ENV NODE_ENV=production \
    NODE_OPTIONS=--max-old-space-size=160
COPY --from=deps /app/node_modules ./node_modules
COPY package.json README.md ./
COPY src ./src
# images the README links to (docs/.gitkeep keeps the directory present)
COPY docs ./docs
CMD ["node", "src/server.ts"]
