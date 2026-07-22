# HYOJO

Mobile-first company OS prototype.

## Apps

- `apps/mobile`: Expo / React Native primary client
- `apps/admin`: Next.js admin-only controls
- `apps/api`: Fastify API and in-memory prototype data
- `packages/domain`: ACL, memory, narration, and audit contracts
- `packages/adaptive-ui`: allow-listed UI surface schema

## Start

```bash
npm install
npm run dev:api
npm run dev:mobile
npm run dev:admin
```

## Durable local data

Start Postgres with `docker compose up -d postgres`, then run `DATABASE_URL=postgres://hyojo:hyojo@localhost:5432/hyojo npm run db:migrate` before starting the API. With no `DATABASE_URL`, the prototype uses ephemeral in-memory data.

See [technical plan](docs/technical-plan.md) for boundaries and phased implementation.

For a phone and Admin walkthrough, see [local demo guide](docs/local-demo.md).
