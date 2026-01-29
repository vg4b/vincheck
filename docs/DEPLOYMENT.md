# Deployment Guide

VIN Info.cz is deployed on Vercel with a Neon PostgreSQL database.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Environment Variables](#environment-variables)
3. [Database Setup](#database-setup)
4. [Vercel Deployment](#vercel-deployment)
5. [Preview Deployments](#preview-deployments)
6. [Cron Jobs](#cron-jobs)
7. [Domain Configuration](#domain-configuration)
8. [Monitoring](#monitoring)
9. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Vercel                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   React SPA  │  │  Serverless  │  │    Cron Jobs         │  │
│  │   (Static)   │  │  Functions   │  │  (Daily 8:00 AM)     │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         │                   │                    │
         │                   │                    │
         ▼                   ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   CDN/Edge      │  │  Neon Postgres  │  │    Resend       │
│   (Static)      │  │   (Database)    │  │   (Email)       │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### Components

| Component            | Description                             |
| -------------------- | --------------------------------------- |
| React SPA            | Frontend application (Create React App) |
| Serverless Functions | API endpoints in `/api` directory       |
| Neon PostgreSQL      | Database for users, vehicles, reminders |
| Resend               | Transactional and marketing emails      |
| Vercel Cron          | Scheduled reminder email sending        |

---

## Environment Variables

### Required Variables

| Variable         | Description                           | Example                        |
| ---------------- | ------------------------------------- | ------------------------------ |
| `POSTGRES_URL`   | Neon database connection string       | `postgres://user:pass@host/db` |
| `JWT_SECRET`     | Secret for JWT signing (min 32 chars) | `your-random-secret-string`    |
| `RESEND_API_KEY` | Resend API key                        | `re_xxxxx`                     |
| `CRON_SECRET`    | Secret for cron job auth              | `your-cron-secret`             |
| `API_KEY`        | Vehicle data API key                  | `your-api-key`                 |

### Optional Variables

| Variable       | Description          | Default                             |
| -------------- | -------------------- | ----------------------------------- |
| `ADMIN_SECRET` | Admin endpoint auth  | Falls back to `CRON_SECRET`         |
| `API_BASE_URL` | Vehicle API base URL | `https://api.dataovozidlech.cz/...` |

### Setting Up Variables

**Via Vercel CLI:**

```bash
# Add a variable for all environments
vercel env add VARIABLE_NAME

# Pull variables to local .env
vercel env pull
```

**Via Vercel Dashboard:**

1. Go to Project → Settings → Environment Variables
2. Add variable name and value
3. Select environments: Production, Preview, Development
4. Save

### Security Notes

- Never commit `.env` files to git
- Use different `JWT_SECRET` for production vs development
- Rotate secrets periodically
- All secrets should be at least 32 characters

---

## Database Setup

### Neon PostgreSQL

1. **Create Database:**
   - Go to [neon.tech](https://neon.tech)
   - Create a new project
   - Copy the connection string

2. **Add to Vercel:**
   - Add `POSTGRES_URL` environment variable
   - Or use Vercel's Neon integration

3. **Tables Auto-Create:**
   - Tables are created automatically on first API request
   - See `api/_db.ts` for schema

### Database Schema

```sql
-- Users table
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  terms_accepted_at timestamptz,
  email_verified_at timestamptz,
  email_verification_code text,
  email_verification_expires_at timestamptz,
  notifications_enabled boolean NOT NULL DEFAULT true,
  marketing_enabled boolean NOT NULL DEFAULT true
);

-- Vehicles table
CREATE TABLE vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vin text,
  tp text,
  orv text,
  title text,
  brand text,
  model text,
  snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Reminders table
CREATE TABLE reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  type text NOT NULL,
  due_date date NOT NULL,
  note text,
  is_done boolean NOT NULL DEFAULT false,
  email_enabled boolean NOT NULL DEFAULT true,
  email_send_at date,
  email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE UNIQUE INDEX vehicles_user_vin_unique ON vehicles(user_id, vin) WHERE vin IS NOT NULL;
CREATE INDEX reminders_user_due_idx ON reminders(user_id, due_date);
CREATE INDEX reminders_email_send_idx ON reminders(email_send_at) WHERE email_enabled = true;
```

---

## Vercel Deployment

### Initial Setup

1. **Install Vercel CLI:**

   ```bash
   npm i -g vercel
   ```

2. **Link Project:**

   ```bash
   vercel link
   ```

3. **Set Environment Variables:**

   ```bash
   vercel env add POSTGRES_URL
   vercel env add JWT_SECRET
   vercel env add RESEND_API_KEY
   vercel env add CRON_SECRET
   vercel env add API_KEY
   ```

4. **Deploy:**

   ```bash
   # Preview deployment
   vercel

   # Production deployment
   vercel --prod
   ```

### Project Configuration

**vercel.json:**

```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    },
    {
      "source": "/((?!api/|static/|logos/|...).*)",
      "destination": "/index.html"
    }
  ],
  "crons": [
    {
      "path": "/api/cron/send-reminders",
      "schedule": "0 8 * * *"
    }
  ]
}
```

### Build Settings

| Setting          | Value            |
| ---------------- | ---------------- |
| Framework        | Create React App |
| Build Command    | `npm run build`  |
| Output Directory | `build`          |
| Install Command  | `npm install`    |

---

## Preview Deployments

### How It Works

Every push to a non-production branch creates a preview deployment:

- Unique URL: `https://projectname-xxx-username.vercel.app`
- Same environment variables (if enabled for Preview)
- Isolated from production

### Testing on Preview

1. Push changes to a branch
2. Vercel creates preview deployment
3. Test at the preview URL
4. Merge to main for production

### Deployment Protection

If you enable Vercel Authentication for previews:

- API calls may fail with 401
- Disable protection or configure bypass for testing

**To disable protection:**

1. Project → Settings → Deployment Protection
2. Set to "Only Production" or disable

---

## Cron Jobs

### Configuration

Cron jobs are defined in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/send-reminders",
      "schedule": "0 8 * * *"
    }
  ]
}
```

### Schedule Format

```
0 8 * * *
│ │ │ │ │
│ │ │ │ └── Day of week (0-7, Sunday = 0 or 7)
│ │ │ └──── Month (1-12)
│ │ └────── Day of month (1-31)
│ └──────── Hour (0-23, UTC)
└────────── Minute (0-59)
```

Current schedule: **Daily at 8:00 AM UTC**

### Manual Trigger

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://vininfo.cz/api/cron/send-reminders
```

### Monitoring

- View cron logs in Vercel Dashboard → Deployments → Functions
- Failed crons appear in Vercel notifications
- Check for errors in function logs

---

## Domain Configuration

### Custom Domain

1. **Add Domain:**
   - Project → Settings → Domains
   - Add `vininfo.cz` and `www.vininfo.cz`

2. **DNS Configuration:**

   ```
   A     @     76.76.21.21
   CNAME www   cname.vercel-dns.com
   ```

3. **SSL:**
   - Automatically provisioned by Vercel
   - Forced HTTPS redirect

### Email Domain (Resend)

1. **Add Domain in Resend:**
   - Resend Dashboard → Domains → Add Domain
   - Add `mail.vininfo.cz`

2. **DNS Records:**
   - Add MX, TXT, and DKIM records as provided by Resend
   - Verify domain in Resend dashboard

---

## Monitoring

### Vercel Analytics

- Real-time traffic monitoring
- Performance metrics (Web Vitals)
- Enable in Project → Analytics

### Function Logs

- Project → Deployments → Select deployment → Functions
- Real-time logs for serverless functions
- Filter by function name

### Error Tracking

Consider adding:

- Sentry for error tracking
- LogDNA/Papertrail for log aggregation

---

## Troubleshooting

### Common Issues

#### Build Fails

```
Error: Cannot find module 'xyz'
```

**Solution:** Check `package.json` dependencies are installed.

#### API Returns 500

**Check:**

1. Environment variables are set correctly
2. Database connection string is valid
3. Function logs for specific error

#### CORS Errors

**Check:**

1. Origin is in allowed list (`api/vehicle.js`)
2. Preview URL includes `.vercel.app`

#### Cron Not Running

**Check:**

1. `vercel.json` has correct cron config
2. `CRON_SECRET` is set
3. Function logs for errors

#### Emails Not Sending

**Check:**

1. `RESEND_API_KEY` is set
2. Domain is verified in Resend
3. User has verified email
4. `notifications_enabled` is true

### Useful Commands

```bash
# View deployment logs
vercel logs [deployment-url]

# List environment variables
vercel env ls

# Pull env vars to local
vercel env pull

# Inspect deployment
vercel inspect [deployment-url]
```

### Support Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Neon Documentation](https://neon.tech/docs)
- [Resend Documentation](https://resend.com/docs)

---

## Local Development

### Setup

1. **Clone and Install:**

   ```bash
   git clone <repo>
   cd vincheck
   npm install
   ```

2. **Pull Environment Variables:**

   ```bash
   vercel env pull
   ```

3. **Run Development Server:**

   ```bash
   vercel dev
   ```

   This runs both the React app and serverless functions locally.

### Alternative: React Only

```bash
npm start
```

Note: API endpoints won't work without `vercel dev`.

### Testing API Locally

```bash
# Test vehicle API
curl "http://localhost:3000/api/vehicle?vin=WVWZZZ1KZDP015799"

# Test cron job
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  http://localhost:3000/api/cron/send-reminders
```
