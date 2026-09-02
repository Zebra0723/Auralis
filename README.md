# Auralis

**Everything, connected.**

Auralis connects the online services you use and keeps selected information
synchronized between them. Change something once and Auralis works out which of
your connected accounts support that field, then updates them for you.

Auralis is a DailyOS company, built and operated as a separate product.

---

## What was built

| Area | Status |
|---|---|
| Marketing homepage | Hero with animated connection diagram, problem, how it works, services, automation examples, security, pricing, FAQ, final CTA |
| Authentication | Email and password, scrypt hashing, opaque server-side sessions |
| Dashboard | Overview, Connections, Syncs, Activity, Rules, Settings |
| Integration framework | One interface, a provider registry, capability descriptors |
| Sync engine | Hub-and-spoke reconciliation with per-field conflict detection |
| Job system | Postgres-backed queue, exponential backoff, stalled-job recovery, separate worker |
| Conflict handling | Keep either side, merge, or set a standing preference |
| Rules | Visual builder over stored trigger/condition/action data |
| Security | AES-256-GCM credential vault, OAuth state and PKCE server-side, audit log |
| Responsive | Sidebar on desktop, purpose-built bottom navigation on mobile |
| Billing | **Not implemented** — no payment credentials were provided |

---

## Which integrations genuinely work

This is the honest breakdown. Nothing in the interface pretends to work when it
does not.

### Working now, with no setup by an administrator

| Service | What it does |
|---|---|
| **Auralis Vault** | The canonical record. Edit a field in Settings and it propagates outward. Works immediately. |
| **GitHub** | Real reads *and writes* against `api.github.com` — display name, company, location, bio, website. Connect it with a personal access token; no OAuth app registration needed. |

Connect the Vault and GitHub and the entire pipeline is exercised against a live
third-party API: sync creation, background jobs, retries, checkpoints, conflict
detection, activity, and rules.

### Built and complete, but require API credentials

Each of these is a full implementation against the provider's real API. They are
inert — and clearly marked **"Requires API configuration"** in the UI — until the
listed environment variables are present.

| Service | Env vars | Capability |
|---|---|---|
| Google (People API) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Read and write |
| Microsoft (Graph) | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | Read and write, webhooks |
| Slack | `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` | Read and write |
| Zoom | `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` | Read and write |
| Trello | `TRELLO_API_KEY` | Read and write |
| Dropbox | `DROPBOX_CLIENT_ID`, `DROPBOX_CLIENT_SECRET` | Read only |
| Google Drive | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Read only |
| Asana | `ASANA_CLIENT_ID`, `ASANA_CLIENT_SECRET` | Read only |
| Discord | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | Read only |

Read-only means the provider's API exposes no write endpoint for these profile
fields. Auralis declares that in its capability descriptor, so the sync builder
will not offer that service as a destination rather than letting you configure
something that would fail.

### Listed, not built

Notion, LinkedIn and HubSpot appear in the marketplace as **Coming soon**. They
have no adapter, and every operation on them refuses rather than faking success.

---

## Getting credentials for a service

Each provider issues credentials from its own developer console. This is a step
only a human with an account there can do.

| Service | Where |
|---|---|
| Google / Drive | https://console.cloud.google.com/apis/credentials — OAuth 2.0 Client ID (Web application), enable the People API and Drive API |
| Microsoft | https://entra.microsoft.com — register an application, add a Web redirect URI, grant delegated `User.ReadWrite` |
| Slack | https://api.slack.com/apps — add user scopes `users.profile:read` and `users.profile:write` |
| Zoom | https://marketplace.zoom.us/develop/create — General App with `user:read` and `user:write` |
| Dropbox | https://www.dropbox.com/developers/apps — permission `account_info.read` |
| Asana | https://app.asana.com/0/my-apps |
| Discord | https://discord.com/developers/applications — scopes `identify`, `email` |
| Trello | https://trello.com/power-ups/admin — create a Power-Up to get an API key |
| GitHub | https://github.com/settings/tokens?type=beta — fine-grained token, Account permissions → Profile: Read and write |

For every OAuth provider, register this redirect URI:

```
https://<your-domain>/api/oauth/<provider-key>/callback
```

For example `https://auralis.example.com/api/oauth/google/callback`.

---

## Environment variables

### Required

```bash
# PostgreSQL connection string
DATABASE_URL="postgresql://user:password@host:5432/auralis"

# 32 bytes, base64. Encrypts every stored OAuth token.
# Generate with: openssl rand -base64 32
AURALIS_ENCRYPTION_KEY="..."

# Absolute public URL. Must match the OAuth redirect URIs you registered.
NEXT_PUBLIC_APP_URL="https://auralis.example.com"
```

Losing `AURALIS_ENCRYPTION_KEY` means every stored connection must be
reconnected. It should come from a secret manager, never from the repository.

### Optional, one pair per service

```bash
GOOGLE_CLIENT_ID=          GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=       MICROSOFT_CLIENT_SECRET=
SLACK_CLIENT_ID=           SLACK_CLIENT_SECRET=
DROPBOX_CLIENT_ID=         DROPBOX_CLIENT_SECRET=
ZOOM_CLIENT_ID=            ZOOM_CLIENT_SECRET=
ASANA_CLIENT_ID=           ASANA_CLIENT_SECRET=
DISCORD_CLIENT_ID=         DISCORD_CLIENT_SECRET=
TRELLO_API_KEY=
```

Any service whose variables are absent shows as **Requires API configuration** and
cannot be connected. Nothing breaks.

---

## Running locally

```bash
npm install

# Start PostgreSQL however you prefer, then:
cp .env.example .env          # fill in DATABASE_URL and AURALIS_ENCRYPTION_KEY
npx prisma migrate dev        # create the schema
npm run db:seed               # insert the three plans

npm run dev                   # http://localhost:3000
npm run worker                # in a second terminal — runs the sync jobs
```

The worker is a separate process on purpose: a slow provider call must never
block a web request. Nothing syncs unless it is running.

### Seeing a real sync work end to end

1. Sign up at `/signup`.
2. Go to **Connections**, connect **Auralis Vault** (instant), then **GitHub**
   with a personal access token.
3. Go to **Syncs**, create `Auralis Vault → GitHub`, select `Bio` and `Location`.
4. In **Settings**, edit your canonical record and save.
5. The worker picks up the job and writes to your live GitHub profile. **Activity**
   records what changed.

---

## Deploying

A GitHub Actions workflow (`.github/workflows/deploy.yml`) typechecks every push
and deploys to Vercel — previews for pull requests, production for `main`.

Repository secrets required:

- `VERCEL_TOKEN` — https://vercel.com/account/tokens
- `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` — from `.vercel/project.json` after
  running `vercel link`

Runtime environment variables go in the **Vercel project's** environment
settings, not in GitHub — `vercel pull` fetches them at build time.

### Two things Vercel cannot do for you

**Migrations.** Run `npx prisma migrate deploy` against the production database
as a release step. It is deliberately not part of the build: a build that mutates
the production schema on every preview deploy is a bad afternoon.

**The worker.** Vercel serverless functions are request-scoped, so the long-lived
worker loop needs somewhere else — a small Railway/Render/Fly worker service
running `npm run worker`, or a cron that invokes the queue drain on a schedule.
**Without a worker running somewhere, nothing ever syncs.**

---

## Architecture

### Hub and spoke

Every connection reconciles against one canonical record, not against every other
connection. With ten services, pairwise mapping means 45 relationships and 45 sets
of conflict rules; hub-and-spoke means ten. It is also what makes "change it once
in Auralis" a real operation rather than a fan-out of special cases.

### Adding a service

Write one file exporting a `ProviderDescriptor` and an `Integration`, then add it
to the array in `lib/integrations/registry.ts`. Nothing else changes — the sync
engine, the queue and the entire UI read from the descriptor.

```ts
authenticate() · refreshToken() · getData() · updateData()
deleteData()   · subscribeToChanges() · disconnect()
```

Descriptors also declare, per record type, which fields the provider can read and
which it can write. The sync builder intersects the source's readable fields with
the destination's writable ones, so a sync that could never succeed cannot be
configured in the first place.

### Conflict detection

`FieldCheckpoint` stores the last value Auralis observed for each field on each
connection. On every run it compares both sides against their checkpoints:

- Neither moved, or they already agree → nothing to do
- Exactly one moved → write it to the other side
- **Both moved → raise a conflict and change nothing**

Without stored history, "both changed" is indistinguishable from "one changed",
and the more recent write silently destroys the other. That is the failure mode
this table exists to prevent.

### Job queue

`SyncJob` rows are claimed with `UPDATE ... FROM (SELECT ... FOR UPDATE SKIP
LOCKED)`, so multiple workers can run without blocking each other or needing a
broker. Failures back off exponentially (30s, 1m, 2m, 4m, 8m, capped at an hour)
with jitter, so a provider outage does not produce a synchronised retry stampede
when it recovers. Jobs whose worker died are reclaimed after five minutes.

### Errors

Providers throw `IntegrationError` carrying a message written for the person who
owns the connection:

> Your Google connection has expired. Reconnect Google to continue syncing.

rather than `OAuthError 401 refresh_token_invalid`. A failure is only surfaced in
Activity once retries are exhausted; a blip that recovers is not news.

---

## Security

- **No third-party passwords are ever received.** OAuth redirect flows, or tokens
  you issue yourself.
- **Tokens encrypted at rest** with AES-256-GCM under a key held outside the
  database. Decryption happens only in the process that calls the provider.
- **No route serialises credentials.** `OAuthCredential` is never included in an
  API response.
- **OAuth state and PKCE verifiers** are stored server-side, single-use, and
  expire in ten minutes. A callback with a state we did not issue is refused.
- **Sessions are opaque random tokens**, stored only as SHA-256 hashes, so a
  database leak yields no usable cookies and revocation is immediate.
- **Passwords** hashed with scrypt — memory-hard, and in Node's standard library,
  so nothing extra sits in the trust path.
- Sign-in timing is equalised so response time does not reveal whether an address
  is registered.

---

## Known limitations

1. **Only two integrations are verifiable without credentials** — the Vault and
   GitHub. The other nine are complete implementations that have not been run
   against live credentials, because registering OAuth applications requires a
   human with an account at each provider.
2. **No billing.** Plan limits are enforced; there is no way to change plan.
3. **The worker must be hosted separately** from Vercel. See above.
4. **Webhooks are declared but not received.** `subscribeToChanges` is implemented
   for Microsoft Graph, but the inbound webhook receiver is not built, so
   `REALTIME` currently behaves as a five-minute poll.
5. **`NEWEST_WINS` deliberately falls back to asking.** Most provider APIs do not
   expose per-field modification times, so "newest" cannot be established
   honestly. Guessing here would silently destroy data.
6. **One canonical profile per workspace.** Contact-level sync is modelled in the
   schema and the interface, but only profile records are wired end to end.
7. **No email.** No verification, password reset, or notifications — no SMTP
   credentials were available.
8. **Single-region Postgres**, no read replicas or connection pooling beyond
   Prisma's default. Fine to low thousands of users; PgBouncer beyond that.

---

## Recommended next steps

1. **Register one OAuth app** (Google is the highest-value) and verify the flow
   end to end. Everything else is already built around it.
2. **Host the worker** and confirm scheduled syncs run unattended.
3. **Build the webhook receiver** at `/api/webhooks/[provider]` so `REALTIME`
   becomes genuinely real-time. Microsoft Graph already subscribes.
4. **Add email** — verification, and a single digest when a connection breaks.
5. **Wire billing** once a payment provider is chosen. `Plan` and `Subscription`
   already exist and limits are already enforced.
6. **Contact-level sync.** The schema supports it; it needs list reconciliation
   and identity matching, which is a materially harder problem than one profile.
7. **Tests.** The conflict matrix in `lib/sync/engine.ts` is the highest-value
   place to start, and is pure enough to test without network access.

---

## Project layout

```
app/
  page.tsx               marketing homepage
  (auth)/                sign in, sign up
  dashboard/             overview, connections, syncs, activity, rules, settings
  api/                   internal API — validated server-side, one error shape
lib/
  integrations/
    types.ts             the Integration contract
    base.ts              OAuth / token / planned provider factories
    oauth2.ts            shared OAuth 2.0 and HTTP error mapping
    registry.ts          the single list of known services
    providers/           one file per service
  sync/
    engine.ts            reconciliation and conflict detection
    rules.ts             rule evaluation
  queue.ts               Postgres job queue
  crypto.ts              credential encryption, password hashing
worker/                  background worker process
prisma/schema.prisma     relational schema
```
