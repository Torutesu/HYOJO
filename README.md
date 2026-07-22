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
```

See [technical plan](docs/technical-plan.md) for boundaries and phased implementation.
