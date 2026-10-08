# Hostinger MySQL (phpMyAdmin)

The API uses **MySQL/MariaDB** via TypeORM (`mysql2`). Use phpMyAdmin only to inspect data—not to define schema (migrations are source of truth).

## 1. Create database (hPanel)

1. **Websites → Databases → MySQL Databases** — create database and user.
2. Charset **utf8mb4** / **utf8mb4_unicode_ci**.
3. Assign user with **ALL PRIVILEGES** on that database.
4. Note host (usually **`localhost`** for the Node app on the same Hostinger account).

## 2. Environment (Hostinger Node app)

```env
DATABASE_URL=mysql://USER:PASSWORD@localhost:3306/DATABASE_NAME
DATABASE_SYNC=false
DATABASE_MIGRATIONS_RUN=true
```

URL-encode special characters in the password.

On first deploy to an **empty** database, `InitialSchema1739080000000` creates all tables.

## 3. Cutover from Supabase

1. Deploy this MySQL-enabled API build.
2. Point `DATABASE_URL` at Hostinger MySQL (not Supabase).
3. Restart the app; confirm logs show migration success and `/api/health` returns JSON.
4. Register a user or set `SUPER_ADMIN_*` and restart once to seed admin (fresh DB).
5. Optionally export/archive Supabase, then disable the old project.

## 4. Local dev

```env
DATABASE_URL=mysql://quickreview:quickreview@127.0.0.1:3306/quickreview
DATABASE_SYNC=true
```

E2E tests use in-memory SQLite and do not require MySQL.
