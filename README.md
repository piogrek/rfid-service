# rfid-service

Cloudflare Worker backend for Track Along ingest, query, auth, and admin APIs.

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
