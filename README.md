# rfid-service

Cloudflare Worker backend for Track Along ingest, query, auth, and admin APIs.

Product terminology:
- Reader: physical RFID unit (claimed via admin, reports sightings).
- Legacy wire fields `agent_id` / `agent_zone` are still used for telemetry and DB; UI surfaces them as "Reader" / "Zone".

## Readers

Claimed readers are `api_keys` rows with `hardware_id` set.

- `POST /api/claim` actions:
  - `register` (device): register hardware + claim code → `{ registered: true }`
  - `status` (device): poll claim; when claimed, returns one-time `config` including `api_key`, then clears bootstrap secret
  - `claim` (admin JWT): assign zone, issue API key, store bootstrap secret for device pickup
- `GET /api/readers` (admin): list hardware readers
- `PUT /api/readers/:id` (admin): update name, zone, MQTT server/port, timezone — **not** API key
- `GET /api/reader/config` (reader Bearer): non-secret config for one-shot boot pull (`api_key` always empty)

Cloud is source of truth for name, zone, MQTT, timezone on claimed readers. API key is issued at claim (device bootstrap once) or pasted on the device admin portal. MQTT fields are stored for future use; ingest is HTTP today.

## Messages API (Contact Us)

New entity: `messages`

- `POST /api/messages` (public): create a message from contact form.
	- Required fields: `name`, `email`, `turnstile_token`
	- Optional field: `content`
	- Turnstile verification is enforced server-side.
- `GET /api/messages` (admin only): list messages.
- `GET /api/messages/:id` (admin only): get one message.

## Environment setup

Set Worker secret:

```bash
wrangler secret put TURNSTILE_SECRET
```

Allowed frontend origins for CORS are configured in `wrangler.toml` via:

- `PORTAL_ORIGINS` (comma-separated origins)

## Database migration

Apply schema remotely with:

```bash
npm run db:migrate:remote
```

For local development DB:

```bash
npm run db:migrate:local
```
