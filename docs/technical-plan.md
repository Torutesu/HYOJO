# HYOJO technical plan

## Decision

- Mobile native is the primary client: Home, Speak, Detail, Huddle, and approvals.
- Web is limited to Admin and large-screen review.
- Huddle media recording happens server-side, never by relying on a backgrounded device.
- Adaptive UI is a schema rendered from allow-listed native components; it is not arbitrary generated code.

## Initial vertical slice

1. `POST /v1/speak` accepts an unfiled utterance.
2. The API emits an audit event and returns an AI narration card.
3. The mobile Home screen renders the narration and a safe Adaptive Surface.
4. An approval emits an audit event and becomes durable domain state in a later persistence phase.

## Next infrastructure increments

1. Postgres + row-level tenancy + durable audit log.
2. Auth and Space ACL enforcement.
3. LiveKit token service, Huddle state machine, and server-side Egress.
4. Transcription, translation, retention worker, and Institutional Memory index.
5. Admin policy controls and metering.

## LiveKit recording configuration

Set `HYOJO_RECORDING_PROVIDER=livekit` only with all of the following server-side environment variables. Missing configuration fails closed at Huddle join; the app must never claim a recording is active when Egress did not start.

```
LIVEKIT_URL=wss://...
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
RECORDING_S3_BUCKET=...
RECORDING_S3_REGION=...
RECORDING_S3_ACCESS_KEY=...
RECORDING_S3_SECRET=...
```

The local default provider is an in-memory recording seam for development and tests only. Production must set the LiveKit provider and object-storage credentials.

The mobile client requests a 15-minute, room-scoped token from `POST /v1/huddles/:id/token` only after the server has accepted the Huddle join. `LIVEKIT_API_SECRET` stays on the API; it must never be exposed through `EXPO_PUBLIC_*` variables. LiveKit's React Native SDK requires an Expo development build, not Expo Go, because it uses native WebRTC modules. `apps/mobile/app.json` enables the official LiveKit and WebRTC config plugins; their WebRTC plugin is pinned to the Expo 54-compatible major version.

## Transcript-to-memory boundary

Ending a Huddle stops server-side recording immediately, but does not manufacture a summary. A transcript worker (or a Space admin in the prototype) submits `POST /v1/huddles/:id/transcript` only after completion; the endpoint creates the Institutional Memory record only when the Space permits indexing. Production workers authenticate with `HYOJO_TRANSCRIPT_INGEST_KEY`; the key is server-side only. Video is retained as evidence and is never supplied to the memory-generation input.

## Postgres persistence

Set `DATABASE_URL` to use the durable repository. Apply `apps/api/migrations/001_initial.sql` before starting the API. Without `DATABASE_URL`, the API deliberately uses the in-memory store for local prototype work only; no state survives a restart.
