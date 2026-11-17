# Smile Architect Dental Clinic – Web Application & Booking System

Full-stack healthcare web application and online appointment scheduling platform for **Smile Architect Dental Clinic** (Hebbal 2nd Stage, Mysuru, Karnataka, India – 570017).

## Architecture Overview

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons
- **Backend**: Node.js + Express (`server.ts`)
- **Database**: Relational SQLite (`better-sqlite3`, WAL mode, foreign keys enforced, `BEGIN IMMEDIATE` ACID booking transactions)
- **Authentication**: `crypto.scrypt` password hashing + HMAC-SHA256 signed `HttpOnly` session cookies for `/admin`

## Database Tables (`server/db.ts`)

1. `users`
2. `administrators`
3. `doctors`
4. `services`
5. `doctor_services`
6. `appointments`
7. `availability`
8. `blocked_dates`
9. `blocked_slots`
10. `clinic_settings`
11. `enquiries`
12. `gallery`
13. `testimonials`

## Environment Variables (`.env`)

Copy `.env.example` to `.env` and configure:

- `ADMIN_USER` / `ADMIN_EMAIL` – Administrator login email (default: `sakshigadadan@gmail.com`)
- `ADMIN_PASSWORD` – Administrator login password (set a strong password before deployment)
- `SESSION_SECRET` – Long random secret for signing admin session cookies
- `DB_PATH` – SQLite database path (default: `./data/smile_architect.db`)
- `APP_URL` – Public HTTPS URL for sitemap/canonical links
- `WHATSAPP_CLOUD_TOKEN` & `WHATSAPP_PHONE_NUMBER_ID` – Optional WhatsApp Business Cloud API credentials (falls back cleanly to WhatsApp click-to-chat URLs when unset)
- `EMAIL_WEBHOOK_URL` – Optional transactional email webhook
- `SUPABASE_URL` & `SUPABASE_PUBLISHABLE_KEY` – Server-side Supabase connection for syncing appointment bookings and enquiries
- `SUPABASE_SECRET_KEY` – Optional Supabase secret/service_role key if admin status updates/reschedules should also update existing rows in Supabase

## Supabase Setup

1. Open your Supabase Dashboard → **SQL Editor**.
2. Paste and execute the contents of `supabase/schema.sql` to create the `appointments`, `enquiries`, `doctors`, and `services` tables along with secure Row Level Security (RLS) policies.
3. Ensure `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are set in `.env` (server-side only). Every new appointment submitted on `/book` and enquiry submitted on `/contact` will automatically sync to Supabase while keeping atomic slot locking on the server.

## Local Development & Production Deployment

```bash
# Install dependencies
npm install

# Run unit tests (IST scheduling & validation logic)
npx --yes tsx --test src/utils/scheduling.test.ts

# Typecheck
npm run lint

# Start development server on port 3000
npm run dev

# Build frontend for production and run Express server
npm run build
npm start
```

## Database Backups

Authorized administrators can download a complete JSON backup of clinic data and appointments anytime from **Admin Dashboard → Overview → Download Database Backup (JSON)** or export appointments to CSV from **Admin Dashboard → Appointments → Export CSV**.
