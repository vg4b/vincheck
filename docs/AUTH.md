# Authentication Documentation

VIN Info.cz uses a custom JWT-based authentication system with email verification.

## Table of Contents

1. [Overview](#overview)
2. [Registration Flow](#registration-flow)
3. [Login Flow](#login-flow)
4. [Session Management](#session-management)
5. [Email Verification](#email-verification)
6. [Security Features](#security-features)
7. [API Endpoints](#api-endpoints)
8. [Frontend Integration](#frontend-integration)

---

## Overview

### Technology Stack

| Component          | Technology                  |
| ------------------ | --------------------------- |
| Password Hashing   | bcryptjs (10 rounds)        |
| Session Tokens     | JWT (jsonwebtoken)          |
| Token Storage      | HttpOnly cookies            |
| Verification Codes | crypto.randomInt (6 digits) |

### Authentication State

Users can be in one of these states:

| State         | Description                   |
| ------------- | ----------------------------- |
| Anonymous     | Not logged in                 |
| Authenticated | Logged in, email not verified |
| Verified      | Logged in, email verified     |

---

## Registration Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User      │────▶│  Register   │────▶│  Send Code  │────▶│   Verify    │
│   Form      │     │  Account    │     │   Email     │     │   Email     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### Steps

1. User submits registration form with:
   - Email address
   - Password (min 8 characters)
   - Terms acceptance (required)
   - Marketing consent (optional, default: true)

2. Server:
   - Validates input
   - Checks for existing email
   - Hashes password with bcrypt
   - Generates 6-digit verification code
   - Stores user in database
   - Sends verification email
   - Returns JWT token in HttpOnly cookie

3. User enters verification code

4. Server verifies code and marks email as verified

### Required Fields

| Field              | Validation                 |
| ------------------ | -------------------------- |
| `email`            | Valid email format, unique |
| `password`         | Minimum 8 characters       |
| `termsAccepted`    | Must be `true`             |
| `marketingEnabled` | Boolean (optional)         |

---

## Login Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Login     │────▶│   Verify    │────▶│   Return    │
│   Form      │     │  Password   │     │   JWT       │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Steps

1. User submits email and password
2. Server finds user by email (case-insensitive)
3. Server compares password hash with bcrypt
4. On success, returns JWT token in HttpOnly cookie

---

## Session Management

### JWT Token

```javascript
{
  userId: "uuid",
  iat: 1234567890,    // Issued at
  exp: 1237246290     // Expires (30 days)
}
```

### Cookie Settings

| Setting    | Value         | Purpose                  |
| ---------- | ------------- | ------------------------ |
| `HttpOnly` | `true`        | Prevents XSS attacks     |
| `SameSite` | `Lax`         | CSRF protection          |
| `Secure`   | `true` (prod) | HTTPS only in production |
| `Max-Age`  | 30 days       | Session duration         |
| `Path`     | `/`           | Available site-wide      |

### Session Persistence

The frontend stores user data in `localStorage` for:

- Faster initial page load (no loading state)
- Session persistence across page reloads

On page load:

1. Check localStorage for cached user
2. If cached user exists, validate with `/api/auth/me`
3. If no cached user, assume not logged in (no API call)

---

## Email Verification

### Verification Code

- 6-digit numeric code
- Generated using `crypto.randomInt()` (cryptographically secure)
- Valid for 24 hours
- Stored in database (hashed: no, plain text for simplicity)

### Verification Flow

1. Code sent on registration
2. User can request resend (60 second cooldown)
3. User enters code in verification form
4. Server validates code and expiration
5. On success, `email_verified_at` is set

### Why Verify?

- Required for receiving reminder emails
- Ensures email address is valid and owned by user
- Reduces spam and fake accounts

---

## Security Features

### Password Security

- Minimum 8 characters required
- Hashed with bcrypt (10 salt rounds)
- Never stored in plain text
- Never returned in API responses

### Rate Limiting

| Endpoint                        | Limit                      |
| ------------------------------- | -------------------------- |
| `/api/auth/resend-verification` | 60 seconds cooldown        |
| `/api/auth/login`               | No limit (consider adding) |
| `/api/auth/register`            | No limit (consider adding) |

### Token Security

- JWT signed with `JWT_SECRET` environment variable
- Tokens stored in HttpOnly cookies (not accessible via JavaScript)
- Tokens expire after 30 days
- Logout clears cookie with `Max-Age=0`

### Input Validation

- Email normalized (lowercase, trimmed)
- Password length validated server-side
- SQL injection prevented via parameterized queries

---

## API Endpoints

### POST /api/auth/register

Create a new user account.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "termsAccepted": true,
  "marketingEnabled": true
}
```

**Response (201):**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "created_at": "2024-01-01T00:00:00.000Z",
    "email_verified_at": null,
    "notifications_enabled": true,
    "marketing_enabled": true
  },
  "needsVerification": true
}
```

**Errors:**

- `400` - Invalid input
- `409` - Email already exists

---

### POST /api/auth/login

Authenticate existing user.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response (200):**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "email_verified_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**Errors:**

- `401` - Invalid credentials

---

### POST /api/auth/logout

End user session.

**Request:** (no body)

**Response (200):**

```json
{
  "success": true
}
```

---

### GET /api/auth/me

Get current user info.

**Response (200):**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "email_verified_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**Errors:**

- `401` - Not authenticated

---

### POST /api/auth/verify-email

Verify email with code.

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
    "id": "uuid",
    "email": "user@example.com",
    "email_verified_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**Errors:**

- `400` - Invalid or expired code

---

### POST /api/auth/resend-verification

Request new verification code.

**Response (200):**

```json
{
  "success": true
}
```

**Errors:**

- `400` - Email already verified
- `429` - Rate limited (wait X seconds)

---

## Frontend Integration

### AuthContext

The `AuthContext` provides authentication state and methods:

```typescript
interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (options: RegisterOptions) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  verifyEmail: (code: string) => Promise<void>;
  resendVerification: () => Promise<void>;
}
```

### Usage Example

```tsx
import { useAuth } from "../contexts/AuthContext";

function MyComponent() {
  const { user, loading, login, logout } = useAuth();

  if (loading) return <LoadingSpinner />;

  if (!user) {
    return <LoginForm onSubmit={login} />;
  }

  return (
    <div>
      <p>Welcome, {user.email}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

### Protected Routes

```tsx
function ProtectedPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/prihlaseni");
    }
  }, [user, loading, navigate]);

  if (loading || !user) return null;

  return <div>Protected content</div>;
}
```

---

## Database Schema

### Users Table

```sql
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
```

---

## Environment Variables

| Variable         | Required | Description                     |
| ---------------- | -------- | ------------------------------- |
| `JWT_SECRET`     | Yes      | Secret for signing JWT tokens   |
| `POSTGRES_URL`   | Yes      | Database connection string      |
| `RESEND_API_KEY` | Yes      | For sending verification emails |

### Generating JWT_SECRET

```bash
# Generate a secure random string
openssl rand -base64 32
```
