# Client Zone (Moje VINInfo) Documentation

The Client Zone is a user dashboard for managing vehicles and setting up reminders for important deadlines.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Vehicle Management](#vehicle-management)
4. [Reminders System](#reminders-system)
5. [User Preferences](#user-preferences)
6. [Benefits Section](#benefits-section)
7. [UI Components](#ui-components)

---

## Overview

### Access

- **URL:** `/klientska-zona`
- **Authentication:** Required (redirects to login if not authenticated)
- **Email Verification:** Not required, but needed for email reminders

### Navigation Tabs

| Tab             | Description                       |
| --------------- | --------------------------------- |
| Moje vozidla    | Vehicle list and management       |
| Moje upozornění | All reminders across vehicles     |
| Moje výhody     | Affiliate links and quick actions |
| Nastavení       | Email preferences                 |

---

## Features

### For Users

- ✅ Save vehicles from search results
- ✅ Add vehicles manually (VIN, TP, or ORV)
- ✅ Set custom vehicle names
- ✅ Create reminders for important dates
- ✅ Receive email notifications before deadlines
- ✅ Mark reminders as completed
- ✅ Control email preferences
- ✅ Quick access to insurance and vehicle history services

### Technical Features

- ✅ Real-time vehicle data from Czech vehicle registry
- ✅ Duplicate vehicle detection
- ✅ Loading skeletons for better UX
- ✅ Responsive design (mobile-friendly)
- ✅ Global notification status warnings

---

## Vehicle Management

### Adding Vehicles

**Method 1: From Search Results**

1. Search for a vehicle on the home page
2. Click "Uložit do Moje VINInfo"
3. Vehicle is saved with snapshot data

**Method 2: From Client Zone**

1. Go to Moje VINInfo → Moje vozidla
2. Enter VIN, TP, or ORV
3. Click "Přidat vozidlo"
4. Vehicle data is fetched and saved

### Vehicle Data Stored

| Field      | Description                     |
| ---------- | ------------------------------- |
| `vin`      | Vehicle Identification Number   |
| `tp`       | Technical Passport number       |
| `orv`      | Registration Certificate number |
| `title`    | Custom name (user-defined)      |
| `brand`    | Vehicle brand                   |
| `model`    | Vehicle model                   |
| `snapshot` | Full vehicle data JSON          |

### Vehicle Actions

| Action   | Description                              |
| -------- | ---------------------------------------- |
| Rename   | Set custom title for easy identification |
| Remove   | Delete vehicle and all its reminders     |
| View STK | Shows technical inspection expiry date   |

### Duplicate Detection

- System prevents saving duplicate vehicles
- Checks VIN, TP, and ORV against existing saved vehicles
- "Uložit do Moje VINInfo" button shows "Už uloženo" if vehicle exists

---

## Reminders System

### Supported Reminder Types

| Type                | Code                  | Description                   |
| ------------------- | --------------------- | ----------------------------- |
| Termín STK          | `stk`                 | Technical inspection deadline |
| Povinné ručení      | `povinne_ruceni`      | Liability insurance           |
| Havarijní pojištění | `havarijni_pojisteni` | Comprehensive insurance       |
| Servisní prohlídka  | `servis`              | Service inspection            |
| Přezutí pneu        | `prezuti_pneu`        | Tire change                   |
| Dálniční známka     | `dalnicni_znamka`     | Highway vignette              |
| Jiné                | `jine`                | Other/custom                  |

### Creating Reminders

1. Select a vehicle
2. Choose reminder type
3. Set due date (must be tomorrow or later)
4. Add optional note (max 200 characters)
5. Configure email notification:
   - Enable/disable email
   - Use default send date (1 day before due date)
   - Or set custom send date

### Reminder Fields

| Field           | Required | Description                                |
| --------------- | -------- | ------------------------------------------ |
| `vehicle_id`    | Yes      | Associated vehicle                         |
| `type`          | Yes      | Reminder type code                         |
| `due_date`      | Yes      | Deadline date                              |
| `note`          | No       | User note (max 200 chars)                  |
| `email_enabled` | No       | Send email reminder (default: true)        |
| `email_send_at` | No       | When to send email (default: due_date - 1) |

### Reminder States

| State  | Description                      |
| ------ | -------------------------------- |
| Active | Not done, due date in future     |
| Due    | Not done, due date today or past |
| Done   | Marked as completed              |

### Email Notifications

**Regular delivery:**

- Sent at 8:00 AM UTC on the `email_send_at` date via cron job

**Immediate delivery:**

- If `email_send_at` is today or in the past when creating a reminder, the email is sent **immediately**
- This handles edge cases like creating a reminder with due date = tomorrow (default send date would be today)

**Conditions for sending:**

- User's email is verified
- User's `notifications_enabled` is true
- Reminder's `email_enabled` is true
- `email_sent_at` is null (not already sent)

### Marking as Done

When a reminder is marked as "Splněno" (done):

- `is_done` is set to `true`
- `email_enabled` is automatically set to `false`
- No email will be sent

---

## User Preferences

### Available Settings

| Setting             | Description                | Default |
| ------------------- | -------------------------- | ------- |
| Notifikační emaily  | Receive reminder emails    | Enabled |
| Marketingové emaily | Receive promotional emails | Enabled |

### Global Notification Warning

If global notifications are disabled but a reminder has email enabled:

- Warning icon ⚠️ shown next to the reminder
- Tooltip explains global notifications are off
- Users must enable in Settings to receive emails

### API

```
GET /api/client/preferences
PATCH /api/client/preferences
```

See [API.md](./API.md) for details.

---

## Benefits Section

### Partner Links

| Partner      | Service               | URL                 |
| ------------ | --------------------- | ------------------- |
| Cebia.cz     | Vehicle history check | ehub affiliate link |
| Pojisteni.cz | Insurance comparison  | affiliate link      |

### Quick Actions Per Vehicle

For each saved vehicle, users can:

- Check vehicle history on Cebia (VIN pre-filled)
- Compare insurance on Pojisteni.cz

---

## UI Components

### Loading States

- Skeleton loaders for vehicles and reminders
- Button loading states during actions
- Full-page loading during initial data fetch

### Responsive Design

| Breakpoint | Layout                              |
| ---------- | ----------------------------------- |
| Mobile     | Single column, stacked cards        |
| Tablet     | Two columns                         |
| Desktop    | Full layout with sidebar navigation |

### Form Validation

| Field           | Client Validation | Server Validation |
| --------------- | ----------------- | ----------------- |
| Due date        | min="tomorrow"    | Must be > today   |
| Email send date | min="tomorrow"    | Must be > today   |
| Note            | maxlength="200"   | Max 200 chars     |
| VIN             | 17 characters     | 17 characters     |
| TP              | 6-10 characters   | 6-10 characters   |
| ORV             | 5-9 characters    | 5-9 characters    |

### Error Handling

- Form validation errors shown inline
- API errors shown in alert boxes
- Network errors show generic message
- Duplicate vehicle shows specific message

---

## File Structure

```
src/pages/
└── ClientZonePage.tsx    # Main client zone component (1300+ lines)

api/
├── _reminderEmail.ts     # Shared reminder email utility
├── client/
│   ├── vehicles.ts       # Vehicle CRUD operations
│   ├── reminders.ts      # Reminder CRUD operations (+ immediate email)
│   └── preferences.ts    # User preferences
└── cron/
    └── send-reminders.ts # Daily cron job for scheduled emails

src/utils/
└── clientZoneApi.ts      # Frontend API client
```

---

## API Endpoints Summary

| Method | Endpoint                           | Description            |
| ------ | ---------------------------------- | ---------------------- |
| GET    | `/api/client/vehicles`             | List user's vehicles   |
| POST   | `/api/client/vehicles`             | Add a vehicle          |
| PATCH  | `/api/client/vehicles`             | Update vehicle title   |
| DELETE | `/api/client/vehicles?id=`         | Remove a vehicle       |
| GET    | `/api/client/reminders`            | List all reminders     |
| GET    | `/api/client/reminders?vehicleId=` | List vehicle reminders |
| POST   | `/api/client/reminders`            | Create a reminder      |
| PATCH  | `/api/client/reminders`            | Update a reminder      |
| DELETE | `/api/client/reminders?id=`        | Delete a reminder      |
| GET    | `/api/client/preferences`          | Get user preferences   |
| PATCH  | `/api/client/preferences`          | Update preferences     |

See [API.md](./API.md) for full documentation.
