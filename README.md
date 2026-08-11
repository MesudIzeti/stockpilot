# StockPilot

Inventory/stock management app. Backend in `server/` (Node/Express + PostgreSQL),
frontend in `client/` (Angular).

## Requirements

- Node.js
- PostgreSQL running locally (or reachable) with an empty database created

## First-time setup

1. **Database** — create a Postgres database matching `DB_NAME` in your `.env`
   (default `stockpilot`), then run each file in `server/src/config/migrations/`
   against it, in order (001 through 014), e.g.:
   ```bash
   psql -U <DB_USER> -d stockpilot -f server/src/config/migrations/001_initial_schema.sql
   ```
   repeat for each numbered file. Skip this if you're pointing at a database
   that already has these applied.

2. **Backend**
   ```bash
   cd server
   cp .env.example .env   # fill in DB_PASSWORD and EMAIL_PASS
   npm install
   npm run dev             # starts on the PORT set in .env (default 3000)
   ```

3. **Frontend** (separate terminal)
   ```bash
   cd client
   npm install
   npm start                # starts on http://localhost:4200
   ```

Open `http://localhost:4200` once both are running.

## Notes

- `server/.env` is gitignored — never commit it.
- See `server/.env.example` for the required environment variables.
