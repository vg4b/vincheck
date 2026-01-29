# Email System Documentation

VIN Info.cz uses [Resend](https://resend.com) for sending transactional and marketing emails.

## Table of Contents

1. [Configuration](#configuration)
2. [Email Types](#email-types)
3. [User Preferences](#user-preferences)
4. [Verification Emails](#verification-emails)
5. [Reminder Emails](#reminder-emails)
6. [Marketing Emails](#marketing-emails)
7. [Unsubscribe Flow](#unsubscribe-flow)
8. [Rate Limiting](#rate-limiting)
9. [Testing](#testing)

---

## Configuration

### Required Environment Variables

| Variable         | Description                                                        | Required |
| ---------------- | ------------------------------------------------------------------ | -------- |
| `RESEND_API_KEY` | Resend API key                                                     | Yes      |
| `CRON_SECRET`    | Secret for cron job authentication                                 | Yes      |
| `JWT_SECRET`     | Secret for JWT tokens (unsubscribe links)                          | Yes      |
| `ADMIN_SECRET`   | Secret for admin endpoints (optional, falls back to `CRON_SECRET`) | No       |

### Sender Domain

All emails are sent from: `VINInfo <noreply@mail.vininfo.cz>`

The domain `mail.vininfo.cz` must be verified in the Resend dashboard.

---

## Email Types

| Type         | Trigger                            | Rate Limited       | Unsubscribe |
| ------------ | ---------------------------------- | ------------------ | ----------- |
| Verification | User registration / resend request | Yes (60s cooldown) | No          |
| Reminder     | Daily cron job (8:00 AM)           | Yes (600ms delay)  | Yes         |
| Marketing    | Manual admin trigger               | Yes (600ms delay)  | Yes         |

---

## User Preferences

Users can control their email preferences in the client zone settings:

| Preference              | Description              | Default |
| ----------------------- | ------------------------ | ------- |
| `notifications_enabled` | Receive reminder emails  | `true`  |
| `marketing_enabled`     | Receive marketing emails | `true`  |

### API Endpoints

**Get preferences:**

```
GET /api/client/preferences
Authorization: (JWT cookie)
```

**Update preferences:**

```
PATCH /api/client/preferences
Authorization: (JWT cookie)
Content-Type: application/json

{
  "notificationsEnabled": true,
  "marketingEnabled": false
}
```

---

## Verification Emails

Sent when a user registers or requests a new verification code.

### Flow

1. User registers → verification email sent automatically
2. User can request resend (60 second cooldown)
3. Code valid for 24 hours
4. User enters 6-digit code to verify email

### API Endpoints

**Resend verification code:**

```
POST /api/auth/resend-verification
Authorization: (JWT cookie)
```

**Verify email:**

```
POST /api/auth/verify-email
Authorization: (JWT cookie)
Content-Type: application/json

{
  "code": "123456"
}
```

### Rate Limiting

- 60 second cooldown between resend requests
- Returns `429` with `retryAfter` seconds if called too soon

---

## Reminder Emails

Automated emails sent to remind users of upcoming vehicle-related deadlines.

### Supported Reminder Types

| Type                  | Label               |
| --------------------- | ------------------- |
| `stk`                 | Termín STK          |
| `povinne_ruceni`      | Povinné ručení      |
| `havarijni_pojisteni` | Havarijní pojištění |
| `servis`              | Servisní prohlídka  |
| `prezuti_pneu`        | Přezutí pneu        |
| `dalnicni_znamka`     | Dálniční známka     |
| `jine`                | Jiné                |

### Cron Job

**Endpoint:** `/api/cron/send-reminders`  
**Schedule:** Daily at 8:00 AM (`0 8 * * *`)

**Manual trigger:**

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://vininfo.cz/api/cron/send-reminders
```

### Selection Criteria

Reminders are sent when ALL conditions are met:

- `email_enabled = true` on the reminder
- `email_send_at <= today`
- `email_sent_at IS NULL` (not yet sent)
- User's `email_verified_at IS NOT NULL`
- User's `notifications_enabled = true`

### Email Send Date

- Default: 1 day before the due date
- Can be customized per reminder via `email_send_at`

---

## Marketing Emails

Manual emails sent to users who have opted in to marketing communications.

### API Endpoint

```
POST /api/admin/send-marketing
Authorization: Bearer YOUR_CRON_SECRET
Content-Type: application/json
```

### Request Body

| Field       | Type   | Required | Description                           |
| ----------- | ------ | -------- | ------------------------------------- |
| `subject`   | string | Yes      | Email subject line                    |
| `heading`   | string | Yes      | Main heading in email body            |
| `content`   | string | Yes      | HTML content for the email body       |
| `preheader` | string | No       | Preview text shown in inbox           |
| `ctaText`   | string | No       | Call-to-action button text            |
| `ctaUrl`    | string | No       | Call-to-action button URL             |
| `testEmail` | string | No       | If provided, sends only to this email |

### Example: Test Mode

```bash
curl -X POST https://vininfo.cz/api/admin/send-marketing \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Novinka na VIN Info.cz",
    "preheader": "Podívejte se, co je nového...",
    "heading": "Nová funkce: Upozornění na termíny",
    "content": "<p>Nyní si můžete nastavit upozornění na důležité termíny.</p>",
    "ctaText": "Vyzkoušet",
    "ctaUrl": "https://vininfo.cz/klientska-zona",
    "testEmail": "test@example.com"
  }'
```

### Example: Production (All Users)

```bash
curl -X POST https://vininfo.cz/api/admin/send-marketing \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Novinka na VIN Info.cz",
    "heading": "Nová funkce: Upozornění na termíny",
    "content": "<p>Nyní si můžete nastavit upozornění na důležité termíny.</p>",
    "ctaText": "Vyzkoušet",
    "ctaUrl": "https://vininfo.cz/klientska-zona"
  }'
```

### Response

```json
{
  "message": "Sent 150 of 152 marketing emails",
  "sent": 150,
  "total": 152,
  "testMode": false,
  "errors": ["Failed to send to invalid@example.com: ..."]
}
```

---

## Unsubscribe Flow

All reminder and marketing emails include an unsubscribe link.

### How It Works

1. Email contains link: `/api/email/unsubscribe?token=...`
2. Token is a signed JWT containing `userId` and `type` (notifications/marketing)
3. User clicks link → preference is disabled in database
4. User sees confirmation page

### Token Structure

```javascript
{
  userId: "uuid",
  type: "notifications" | "marketing"
}
```

Token is valid for 30 days.

### Unsubscribe Endpoint

```
GET /api/email/unsubscribe?token=JWT_TOKEN
```

Returns an HTML page confirming the unsubscription.

---

## Rate Limiting

### Resend API Limits

Resend has a rate limit of **2 requests per second**.

### Implementation

| Feature             | Rate Limit Strategy                   |
| ------------------- | ------------------------------------- |
| Verification emails | 60 second cooldown per user           |
| Reminder cron job   | 600ms delay between emails            |
| Marketing emails    | 600ms delay between emails            |
| All emails          | Retry with exponential backoff on 429 |

### Retry Logic

The `sendEmail` function in `api/_email.ts` includes automatic retry:

- Max 3 retries
- Exponential backoff: 1s, 2s, 4s
- Retries on 429 (rate limit) and network errors

---

## Testing

### Test Verification Email

1. Register a new account
2. Check inbox for verification code
3. Use "Odeslat znovu" button to test resend (wait 60s)

### Test Reminder Email

```bash
# Trigger cron job manually
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  http://localhost:3000/api/cron/send-reminders
```

Make sure you have:

- A verified email
- `notifications_enabled = true`
- A reminder with `email_enabled = true` and `email_send_at <= today`

### Test Marketing Email

```bash
curl -X POST http://localhost:3000/api/admin/send-marketing \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Test Marketing Email",
    "heading": "Toto je testovací email",
    "content": "<p>Obsah testovacího emailu.</p>",
    "testEmail": "your@email.com"
  }'
```

### Test Unsubscribe

1. Send a test reminder or marketing email
2. Click the "Odhlásit se" link at the bottom
3. Verify the preference was updated in the database

---

## File Structure

```
api/
├── _email.ts                    # Core email sending utilities
├── auth/
│   ├── register.ts              # Sends verification email on signup
│   └── resend-verification.ts   # Resends verification email
├── cron/
│   └── send-reminders.ts        # Daily reminder email cron job
├── admin/
│   └── send-marketing.ts        # Marketing email endpoint
└── email/
    └── unsubscribe.ts           # Unsubscribe handler
```

---

## Troubleshooting

### Emails not sending

1. Check `RESEND_API_KEY` is set correctly
2. Verify domain `mail.vininfo.cz` is verified in Resend dashboard
3. Check Vercel function logs for errors

### Rate limit errors (429)

- The system automatically retries with backoff
- If persistent, check for duplicate cron triggers
- Consider batching or spacing out marketing campaigns

### Unsubscribe link not working

1. Check `JWT_SECRET` is set and consistent across environments
2. Token expires after 30 days - user may need a new email
3. Check Vercel function logs for JWT verification errors

### Verification code not arriving

1. Check spam folder
2. Wait 60 seconds before requesting resend
3. Verify `RESEND_API_KEY` and domain are configured correctly
