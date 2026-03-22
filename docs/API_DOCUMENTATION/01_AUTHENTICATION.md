# Authentication Endpoints

## Base Path: `/auth`

All authentication endpoints are **PUBLIC** (no authentication required) except `/auth/me` and `/auth/admin/users/:userId/promote`.

### 1. Register User
**Endpoint**: `POST /auth/register`
**Access**: Public
**Status**: 201 Created

**Request Body**:
```typescript
{
  email: string;                    // Valid email format (REQUIRED)
  password: string;                 // Min 8 chars, uppercase, lowercase, number (REQUIRED)
  phone_number?: string;            // Vietnamese format 0XXXXXXXXX (optional)
  full_name?: string;               // User's full name (optional)
  identity_number?: string;         // Vietnamese ID card format (optional)
  user_type?: "individual" | "business"; // Default: individual
  tax_id?: string | null;           // For business users (optional)
}
```

**Response** (201):
```typescript
{
  user_id: string;                  // UUID
  email: string;
  verification_required: boolean;   // Always true initially
}
```

**Error Responses**:
- 400: Invalid email, weak password, duplicate email/phone/identity
- 500: Failed to create user

**Business Logic**:
- Creates both Supabase auth user and local DB user atomically
- All users start with `bidder` role
- Email verification required before login
- Validates password strength: uppercase + lowercase + number, 8+ chars
- Validates Vietnamese phone format: 0 followed by 9 digits

---

### 2. Login User
**Endpoint**: `POST /auth/login`
**Access**: Public
**Status**: 200 OK

**Request Body**:
```typescript
{
  email: string;                    // User's email (REQUIRED)
  password: string;                 // User's password (REQUIRED)
}
```

**Response** (200):
```typescript
{
  access_token: string;             // JWT token
  refresh_token: string;            // Refresh token
  expires_in: number;               // Seconds until expiration
  user: {
    id: string;
    email: string;
    fullName: string;
    phoneNumber?: string;
    identityNumber?: string;
    userType: string;               // individual | business
    taxId?: string;
    role: string;                   // bidder | auctioneer | admin | super_admin
    isBanned: boolean;
    deletedAt?: Date;
    createdAt: Date;
  }
}
```

**Error Responses**:
- 400: User not found, invalid credentials
- 401: Authentication failed

---

### 3. Verify Email
**Endpoint**: `POST /auth/verify-email`
**Access**: Public
**Status**: 200 OK

**Request Body**:
```typescript
{
  email: string;                    // User's email (REQUIRED)
  token: string;                    // OTP from email (REQUIRED)
}
```

**Response** (200):
```typescript
{
  message: "Email verified successfully"
}
```

**Error Responses**:
- 400: Invalid or expired token

---

### 4. Resend Verification Email
**Endpoint**: `POST /auth/resend-verification-email`
**Access**: Public
**Status**: 200 OK

**Request Body**:
```typescript
{
  email: string;                    // User's email (REQUIRED)
}
```

**Response** (200):
```typescript
{
  message: "Verification email sent successfully"
}
```

---

### 5. Forgot Password
**Endpoint**: `POST /auth/forgot-password`
**Access**: Public
**Status**: 200 OK

**Request Body**:
```typescript
{
  email: string;                    // User's email (REQUIRED)
}
```

**Response** (200):
```typescript
{
  message: "Password reset code has been sent to your email"
}
```

**Note**: Password reset code sent to email, user follows link to set new password

---

### 6. Get Current User
**Endpoint**: `GET /auth/me`
**Access**: Authenticated
**Status**: 200 OK

**Request Headers**:
```
Authorization: Bearer <access_token>
```

**Response** (200): User object (same as login response)

**Error Responses**:
- 401: Unauthorized, invalid token
- 404: User not found in system

---

### 7. Promote User
**Endpoint**: `PUT /auth/admin/users/:userId/promote`
**Access**: Requires `admin` or `super_admin` role
**Status**: 200 OK
**Guards**: AuthGuard, RolesGuard

**Request Parameters**:
- `userId` (path): UUID of user to promote

**Request Headers**:
```
Authorization: Bearer <admin_token>
```

**Request Body**:
```typescript
{
  role: "bidder" | "auctioneer" | "admin" | "super_admin" // REQUIRED
}
```

**Response** (200):
```typescript
{
  message: "User promoted to {role} successfully",
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  }
}
```

**Error Responses**:
- 401: Unauthorized
- 403: Insufficient permissions (admin cannot promote to admin/super_admin roles)
- 404: User not found

**Business Logic**:
- **super_admin**: Can promote to any role
- **admin**: Can only promote to bidder/auctioneer roles (not admin/super_admin)
- Regular admins cannot create other admins

