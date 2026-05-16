# Sport Backend

Next.js + PostgreSQL backend for the collaborative training app.

## Quick start

### Option A: Docker PostgreSQL

```bash
docker compose up -d
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

Seed admin:

- email: `admin@sport.local`
- password: `Admin12345!`

API base URL: `http://localhost:4000/api`

## Runtime

- API routes live in `src/app/api`.
- Shared server-only code lives in `src/lib`.
- Uploaded files are stored in `UPLOAD_DIR` and served from `/uploads/:file`.
- Workout status sync and reminder creation are available at `POST /api/cron/workouts`.
  Set `CRON_SECRET` and call the endpoint with `Authorization: Bearer <CRON_SECRET>` in production.
