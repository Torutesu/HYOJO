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
