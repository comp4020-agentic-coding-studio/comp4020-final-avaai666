# 1. Stack: Node runs TypeScript directly, node:sqlite, node:http, Server-Sent Events

Date: 2026-10-01
Status: accepted

## Context

- `fly.toml` fixes one shared-cpu machine with 256 MB of memory and one volume at `/data`. There is no separate database server.
- The app is two pages (the register and a pond) plus a live stream. Every state change is a row in an append-only ledger.
- Live updates must reach every open page within about a second, and a page that reconnects must catch up on what it missed.
- Agent sessions are easier to check when there is less machinery between a change and its effect.

## Decision

- Node 24 runs `src/*.ts` directly. `tsconfig.json` sets `erasableSyntaxOnly` so the code stays runnable without a compiler. No build step.
- `node:sqlite` (built into Node) for the database. One file on the volume.
- `node:http` for the server. No framework.
- Server-Sent Events for live updates. Each ledger row is sent with its row id as the event id, so a reconnecting browser's `Last-Event-ID` says exactly which rows to replay.
- Server-rendered HTML plus one plain script. No client framework.

## Alternatives considered

- **A full-stack framework (Astro) + SQLite + SSE.** Rejected: a framework and a build for two pages, and more generated code to review in each session.
- **better-sqlite3.** A mature synchronous SQLite binding, but a native module to compile in the Docker image. `node:sqlite` gives the same synchronous API with nothing to build.
- **WebSockets.** Two-way, but the app only needs server-to-browser push; writes are ordinary POSTs. SSE reconnects by itself and carries `Last-Event-ID`, which matches the ledger's row ids.

## Consequences

- `node:sqlite` is synchronous, so every commit blocks the event loop while it runs. See decision 2.
- `node:sqlite` still prints an experimental warning on Node 24.
- Casting needs JavaScript (it sends a JSON body with a client-made key). Viewing and joining work without it.
- No build step means the image is the source plus production dependencies.
