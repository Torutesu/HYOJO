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
