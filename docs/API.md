# API Reference

Complete API documentation for VIN Info.cz backend services.

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Error Handling](#error-handling)
4. [Auth Endpoints](#auth-endpoints)
5. [Client Zone Endpoints](#client-zone-endpoints)
6. [Vehicle API](#vehicle-api)
7. [Email Endpoints](#email-endpoints)
8. [Admin Endpoints](#admin-endpoints)
9. [Cron Endpoints](#cron-endpoints)

---

## Overview

### Base URL

| Environment | URL                                 |
| ----------- | ----------------------------------- |
| Production  | `https://vininfo.cz/api`            |
| Preview     | `https://vincheck-*.vercel.app/api` |
| Development | `http://localhost:3000/api`         |

### Content Type

All endpoints accept and return JSON:

```
Content-Type: application/json
```

### Authentication Methods

| Method       | Usage                                   |
| ------------ | --------------------------------------- |
| JWT Cookie   | User authentication (set automatically) |
| Bearer Token | Admin/Cron endpoints                    |

---

## Authentication

### User Authentication

User endpoints use JWT tokens stored in HttpOnly cookies. The cookie is automatically set on login/register and sent with each request.

```javascript
// Frontend - cookies sent automatically
fetch("/api/client/vehicles", {
  credentials: "include",
});
```

### Admin/Cron Authentication

Protected endpoints require Bearer token authentication:

```bash
curl -H "Authorization: Bearer YOUR_SECRET" \
  https://vininfo.cz/api/admin/endpoint
```

---

## Error Handling

### Error Response Format

```json
{
  "error": "Error message in Czech or English"
}
```

### HTTP Status Codes

| Code  | Description                    |
| ----- | ------------------------------ |
| `200` | Success                        |
| `201` | Created                        |
| `400` | Bad Request (validation error) |
| `401` | Unauthorized (not logged in)   |
| `404` | Not Found                      |
| `405` | Method Not Allowed             |
| `409` | Conflict (duplicate)           |
| `429` | Rate Limited                   |
| `500` | Internal Server Error          |

---

## Auth Endpoints

### POST /api/auth/register

Create a new user account.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "minimum8chars",
  "termsAccepted": true,
  "marketingEnabled": true
}
```

**Response (201):**

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "created_at": "2024-01-15T10:30:00.000Z",
    "terms_accepted_at": "2024-01-15T10:30:00.000Z",
    "email_verified_at": null,
    "notifications_enabled": true,
    "marketing_enabled": true
  },
  "needsVerification": true
}
```

**Errors:**
| Code | Error |
|------|-------|
| 400 | Email and password are required |
| 400 | Password must be at least 8 characters |
| 400 | You must accept the terms and conditions |
| 409 | User already exists |

---

### POST /api/auth/login

Authenticate existing user.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "userpassword"
}
```

**Response (200):**

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "created_at": "2024-01-15T10:30:00.000Z",
    "email_verified_at": "2024-01-15T10:35:00.000Z",
    "notifications_enabled": true,
    "marketing_enabled": true
  }
}
```

**Errors:**
| Code | Error |
|------|-------|
| 401 | Invalid credentials |

---

### POST /api/auth/logout

End user session.

**Response (200):**

```json
{
  "success": true
}
```

---

### GET /api/auth/me

Get current authenticated user.

**Response (200):**

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "email_verified_at": "2024-01-15T10:35:00.000Z"
  }
}
```

**Errors:**
| Code | Error |
|------|-------|
| 401 | Unauthorized |

---

### POST /api/auth/verify-email

Verify email with 6-digit code.

**Request:**

```json
{
  "code": "123456"
}
```

**Response (200):**

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "email_verified_at": "2024-01-15T10:35:00.000Z"
  }
}
```

**Errors:**
| Code | Error |
|------|-------|
| 400 | Ověřovací kód je povinný |
| 400 | Email je již ověřen |
| 400 | Neplatný ověřovací kód |
| 400 | Platnost ověřovacího kódu vypršela |

---

### POST /api/auth/resend-verification

Request new verification code. Rate limited to 1 request per 60 seconds.

**Response (200):**

```json
{
  "success": true
}
```

**Errors:**
| Code | Error |
|------|-------|
| 400 | Email je již ověřen |
| 429 | Počkejte X sekund před dalším odesláním |

---

## Client Zone Endpoints

All client zone endpoints require user authentication.

### GET /api/client/vehicles

List all user's saved vehicles.

**Response (200):**

```json
{
  "vehicles": [
    {
      "id": "vehicle-uuid",
      "vin": "WVWZZZ1KZDP015799",
      "tp": "UI036202",
      "orv": null,
      "title": "Rodinný Golf",
      "brand": "VOLKSWAGEN",
      "model": "GOLF",
      "snapshot": {
        /* full vehicle data */
      },
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### POST /api/client/vehicles

Add a new vehicle.

**Request:**

```json
{
  "vin": "WVWZZZ1KZDP015799",
  "tp": "UI036202",
  "orv": null,
  "title": "Rodinný Golf",
  "brand": "VOLKSWAGEN",
  "model": "GOLF",
  "snapshot": {
    /* vehicle data from search */
  }
}
```

At least one of `vin`, `tp`, or `orv` is required.

**Response (201):**

```json
{
  "vehicle": {
    "id": "vehicle-uuid",
    "vin": "WVWZZZ1KZDP015799",
    ...
  }
}
```

**Errors:**
| Code | Error |
|------|-------|
| 400 | At least one identifier is required |
| 409 | Vehicle already saved |

---

### PATCH /api/client/vehicles

Update vehicle title.

**Request:**

```json
{
  "id": "vehicle-uuid",
  "title": "New Vehicle Name"
}
```

**Response (200):**

```json
{
  "vehicle": {
    "id": "vehicle-uuid",
    "title": "New Vehicle Name",
    ...
  }
}
```

---

### DELETE /api/client/vehicles?id={vehicleId}

Delete a vehicle and all its reminders.

**Response (200):**

```json
{
  "success": true
}
```

---

### GET /api/client/reminders

List all reminders for the user.

**Query Parameters:**
| Parameter | Description |
|-----------|-------------|
| `vehicleId` | Optional. Filter by vehicle |

**Response (200):**

```json
{
  "reminders": [
    {
      "id": "reminder-uuid",
      "vehicle_id": "vehicle-uuid",
      "type": "stk",
      "due_date": "2024-06-15",
      "note": "Nezapomenout přivézt doklady",
      "is_done": false,
      "email_enabled": true,
      "email_send_at": "2024-06-14",
      "email_sent_at": null,
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### POST /api/client/reminders

Create a new reminder.

**Request:**

```json
{
  "vehicleId": "vehicle-uuid",
  "type": "stk",
  "dueDate": "2024-06-15",
  "note": "Optional note",
  "emailEnabled": true,
  "emailSendAt": "2024-06-14"
}
```

**Reminder Types:**

- `stk` - Termín STK
- `povinne_ruceni` - Povinné ručení
- `havarijni_pojisteni` - Havarijní pojištění
- `servis` - Servisní prohlídka
- `prezuti_pneu` - Přezutí pneu
- `dalnicni_znamka` - Dálniční známka
- `jine` - Jiné

**Response (201):**

```json
{
  "reminder": {
    "id": "reminder-uuid",
    ...
  }
}
```

**Errors:**
| Code | Error |
|------|-------|
| 400 | Vehicle, type, and due date are required |
| 400 | Invalid reminder type |
| 400 | Note is too long |
| 404 | Vehicle not found |

---

### PATCH /api/client/reminders

Update a reminder.

**Request:**

```json
{
  "id": "reminder-uuid",
  "dueDate": "2024-07-15",
  "note": "Updated note",
  "isDone": true,
  "emailEnabled": false,
  "emailSendAt": "2024-07-14"
}
```

All fields except `id` are optional.

**Response (200):**

```json
{
  "reminder": {
    "id": "reminder-uuid",
    ...
  }
}
```

---

### DELETE /api/client/reminders?id={reminderId}

Delete a reminder.

**Response (200):**

```json
{
  "success": true
}
```

---

### GET /api/client/preferences

Get user email preferences.

**Response (200):**

```json
{
  "preferences": {
    "notifications_enabled": true,
    "marketing_enabled": false
  }
}
```

---

### PATCH /api/client/preferences

Update email preferences.

**Request:**

```json
{
  "notificationsEnabled": true,
  "marketingEnabled": false
}
```

**Response (200):**

```json
{
  "preferences": {
    "notifications_enabled": true,
    "marketing_enabled": false
  }
}
```

---

## Vehicle API

### GET /api/vehicle

Fetch vehicle data from Czech vehicle registry.

**Query Parameters (one required):**
| Parameter | Description |
|-----------|-------------|
| `vin` | 17-character VIN code |
| `tp` | 6-10 character TP number |
| `orv` | 5-9 character ORV number |

**Example:**

```
GET /api/vehicle?vin=WVWZZZ1KZDP015799
```

**Response (200):**

```json
[
  { "name": "VIN", "value": "WVWZZZ1KZDP015799", "label": "VIN" },
  { "name": "TovarniZnacka", "value": "VOLKSWAGEN", "label": "Tovární značka" },
  { "name": "Typ", "value": "GOLF", "label": "Typ" },
  ...
]
```

**Errors:**
| Code | Error |
|------|-------|
| 400 | Missing required parameter |
| 401 | API key error |
| 404 | Vehicle not found |

---

## Email Endpoints

### GET /api/email/unsubscribe?token={token}

Unsubscribe from email notifications.

**Query Parameters:**
| Parameter | Description |
|-----------|-------------|
| `token` | JWT token from email |

**Response:** HTML page confirming unsubscription.

---

## Admin Endpoints

### POST /api/admin/send-marketing

Send marketing email to all opted-in users.

**Authentication:** `Authorization: Bearer {ADMIN_SECRET}`

**Request:**

```json
{
  "subject": "Email Subject",
  "heading": "Email Heading",
  "content": "<p>HTML content</p>",
  "preheader": "Preview text",
  "ctaText": "Button Text",
  "ctaUrl": "https://vininfo.cz/...",
  "testEmail": "optional@test.com"
}
```

**Response (200):**

```json
{
  "message": "Sent 150 of 152 marketing emails",
  "sent": 150,
  "total": 152,
  "testMode": false,
  "errors": []
}
```

---

## Cron Endpoints

### GET /api/cron/send-reminders

Trigger reminder email sending. Called daily at 8:00 AM.

**Authentication:** `Authorization: Bearer {CRON_SECRET}`

**Response (200):**

```json
{
  "message": "Sent 25 of 25 reminders",
  "sent": 25,
  "total": 25,
  "errors": []
}
```

---

## Rate Limits

| Endpoint                        | Limit                     |
| ------------------------------- | ------------------------- |
| `/api/auth/resend-verification` | 1 per 60 seconds          |
| `/api/cron/send-reminders`      | 600ms between emails      |
| `/api/admin/send-marketing`     | 600ms between emails      |
| All email sends                 | Retry with backoff on 429 |

---

## CORS

### Allowed Origins

- `https://vininfo.cz`
- `https://www.vininfo.cz`
- `*.vercel.app` (preview deployments)
- `localhost:*` (development)

### Configuration

CORS headers are set in `/api/vehicle.js` for the vehicle proxy endpoint.
