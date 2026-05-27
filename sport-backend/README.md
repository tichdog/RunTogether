# Sport Backend

Next.js + PostgreSQL backend for the collaborative training app.

## Quick start

### Option A: Docker PostgreSQL

```bash
docker compose --profile database up -d postgres
npm install
npm run dev
```

The first Docker start applies `src/db/schema.sql` and `src/db/seed.sql`.
Docker PostgreSQL is exposed on `localhost:5433` to avoid conflicts with a local PostgreSQL on `5432`.

### Option B: Local PostgreSQL

1. Create a database:

```sql
CREATE DATABASE sport_training;
```

2. Copy `.env.example` to `.env` and update `DATABASE_URL`.

3. Install dependencies and apply schema:

```bash
npm install
npm run db:schema
npm run db:seed
npm run dev
```

The backend uses Prisma Client for database access. The current Prisma schema is in
`prisma/schema.prisma`; generate the client after schema changes with:

```bash
npm run prisma:generate
```

Useful Prisma commands:

```bash
npm run db:pull
npm run db:studio
```

Seed admin:

- email: `admin@sport.local`
- password: `Admin12345!`

API base URL: `http://localhost:4000/api`

## Logging

The backend uses Pino for structured JSON logs. Runtime logs are written to stdout and to `logs/backend.log`, so you can see them in the terminal that runs the app:

```bash
npm run dev
```

For prettier local output, run:

```bash
npm run dev:logs
```

Use `LOG_LEVEL` to control verbosity. Common values are `fatal`, `error`, `warn`, `info`, `debug`, and `trace`.

Every route wrapped with `route(...)` writes a completion log with:

- `requestId`
- `req.method`
- `req.path`
- `req.search`
- `status`
- `durationMs`

Successful requests are logged at `info`, client errors at `warn`, and server errors at `error`. Server errors also include a separate `Unhandled route error` entry with the stack trace.

### Grafana

Local observability runs with Grafana, Loki, and Promtail:

```bash
npm run observability:up
```

Open Grafana at `http://localhost:3001` and sign in with `admin` / `admin`. The Loki data source is provisioned automatically.

If you use a local PostgreSQL instance, do not run the Docker `postgres` service. Start only observability with `npm run observability:up`.

To query backend logs in Grafana:

1. Open **Explore**.
2. Select **Loki**.
3. Run `{service="sport-backend"}`.

Useful LogQL queries:

```logql
{service="sport-backend"} |= "Request completed"
```

```logql
{service="sport-backend", status="500"}
```

```logql
{service="sport-backend"} |= "Unhandled route error"
```

Promtail reads JSON logs from `logs/backend.log` and sends them to Loki. Grafana reads from Loki; it does not read the application log file directly.

Stop the observability stack with:

```bash
npm run observability:down
```

### Saved Log Views

Grafana provisions a **Sport Backend Logs** dashboard automatically. Open **Dashboards** -> **Sport Backend** -> **Sport Backend Logs** to use saved log views without typing LogQL every time.

The dashboard includes panels for all API requests, 4xx responses, 5xx responses, slow requests over 100 ms, and unhandled errors with stack traces.

## Runtime

- API routes live in `src/app/api`.
- Shared server-only code lives in `src/lib`.
- Uploaded files are stored in `UPLOAD_DIR` and served from `/uploads/:file`.
- Workout status sync and reminder creation are available at `POST /api/cron/workouts`.
  Set `CRON_SECRET` and call the endpoint with `Authorization: Bearer <CRON_SECRET>` in production.

## Production Safety

In production, the backend fails fast when required environment variables are missing or use development placeholders. Set production values for `CLIENT_ORIGIN`, `DATABASE_URL`, `JWT_SECRET`, and `CRON_SECRET`. `JWT_SECRET` and `CRON_SECRET` should be strong random strings, at least 32 characters long.

Authentication endpoints are rate limited per client IP:

- `POST /api/auth/login`: 5 requests per minute.
- `POST /api/auth/register`: 3 requests per 5 minutes.

When a limit is exceeded, the API returns `429` with `retryAfterSeconds` in the response details.
