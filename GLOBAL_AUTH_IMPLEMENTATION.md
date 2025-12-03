# Global Authentication System Implementation

## Summary

Implemented a flexible, globally-applied authentication system with three modes that can be easily switched via environment variables.

## What Was Implemented

### 1. Global Auth Guard ✅

**File:** `server/src/app/app.module.ts`

Registered `AuthGuard` globally using `APP_GUARD` provider. This means:
- Authentication is applied to **all routes by default**
- No need to add `@UseGuards(AuthGuard)` on every controller
- Individual routes can opt-out using `@Public()` decorator

```typescript
{
  provide: APP_GUARD,
  useClass: AuthGuard,
}
```

### 2. Enhanced Auth Guard with Multiple Modes ✅

**File:** `server/src/common/guards/auth.guard.ts`

The AuthGuard now supports three modes:

#### Mode 1: JWT (Production)
- Validates JWT tokens from `Authorization: Bearer <token>` header
- Uses `SUPABASE_JWT_SECRET` or `JWT_SECRET` for verification
- Enforces token expiration
- Full security

#### Mode 2: Test (Development)
- Two options:
  - **Dynamic:** Send `x-test-user-id` header with each request
  - **Static:** Set `TEST_USER_ID` in `.env` for automatic use
- Bypasses JWT verification
- Useful for API testing and development

#### Mode 3: Disabled (Local Only)
- No authentication required
- Uses mock user data
- ⚠️ **Only for local development**

### 3. Environment Configuration ✅

**File:** `server/.env.example`

Added new environment variables:

```env
# Authentication Mode
AUTH_MODE=jwt  # Options: jwt, test, disabled

# Test User Configuration (for test/disabled modes)
TEST_USER_ID=<optional-user-uuid>
TEST_USER_ROLE=user  # Options: user, auctioneer, admin, super_admin
```

### 4. Public Route Decorator ✅

**File:** `server/src/common/decorators/public.decorator.ts`

Created `@Public()` decorator to mark routes that should bypass authentication:

```typescript
@Public()
@Get('health')
healthCheck() {
  return { status: 'ok' };
}
```

### 5. Updated CurrentUser Decorator ✅

**File:** `server/src/common/decorators/current-user.decorator.ts`

Simplified the decorator:
- Removed `x-test-user-id` handling (now in AuthGuard)
- Relies on global AuthGuard to populate user data
- Added `role` field to `CurrentUserData`
- More consistent behavior across all modes

### 6. Updated App Controller ✅

**File:** `server/src/app/app.controller.ts`

Marked public endpoints with `@Public()` decorator:
- Root endpoint (`/`)
- Health check endpoint (`/health`)

## How to Use

### Quick Setup

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Choose your auth mode in `.env`:**
   ```env
   # For JWT testing:
   AUTH_MODE=jwt
   SUPABASE_JWT_SECRET=your-secret

   # For easy testing:
   AUTH_MODE=test
   TEST_USER_ID=(UUID)
   TEST_USER_ROLE=admin

   # For no auth (local dev only):
   AUTH_MODE=disabled
   ```

3. **Restart the server**

4. **Make requests** (no headers needed in test/disabled mode!)

### Switching Modes

Just change `AUTH_MODE` in `.env` and restart:

```bash
# Test mode with fixed user
echo "AUTH_MODE=test" >> .env
echo "TEST_USER_ID=your-user-uuid" >> .env
npm start

# Back to JWT mode
echo "AUTH_MODE=jwt" >> .env
npm start
```

## Features

### ✅ Global Application
- Applied to all routes automatically
- No need to remember to add guards on controllers
- Consistent authentication across the application

### ✅ Easy Testing
- Test mode allows quick API testing without JWT complexity
- `x-test-user-id` header for dynamic user switching
- `TEST_USER_ID` env var for static user (even easier)

### ✅ JWT Investigation
- Enhanced logging for JWT verification failures
- Detailed error messages
- Easy to debug JWT issues

### ✅ Flexible Configuration
- Switch modes with one environment variable
- No code changes needed
- Works with Postman, curl, or any HTTP client

### ✅ Security
- Production mode enforces full JWT validation
- Test/disabled modes show clear warnings in logs
- Public routes explicitly marked

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  All Requests                   │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │   Global AuthGuard     │
         │  (Applied to all)      │
         └────────┬───────────────┘
                  │
         ┌────────▼────────┐
         │  @Public()?     │
         └────┬────────┬───┘
              │        │
           Yes│        │No
              ▼        ▼
          ┌──────┐  ┌──────────────┐
          │Allow │  │ Check MODE:  │
          └──────┘  │ jwt/test/    │
                    │ disabled     │
                    └──────┬───────┘
                           │
                    ┌──────▼──────┐
                    │ Validate &  │
                    │ Attach User │
                    └──────┬──────┘
                           │
                           ▼
                   ┌───────────────┐
                   │  @CurrentUser │
                   │   Decorator   │
                   └───────┬───────┘
                           │
                           ▼
                   ┌───────────────┐
                   │  Controller   │
                   │   Handler     │
                   └───────────────┘
```

## Files Created/Modified

### Created
1. `server/src/common/decorators/public.decorator.ts` - Public route decorator
2. `server/AUTHENTICATION_GUIDE.md` - Comprehensive guide
3. `server/AUTH_QUICK_START.md` - Quick reference

### Modified
1. `server/src/common/guards/auth.guard.ts` - Enhanced with modes
2. `server/src/app/app.module.ts` - Global guard registration
3. `server/src/common/decorators/current-user.decorator.ts` - Simplified
4. `server/src/app/app.controller.ts` - Added @Public() decorator
5. `server/.env.example` - Added AUTH_MODE configuration

## Testing

### Build Status
✅ **Successful** - All TypeScript compilation passed

### Test Scenarios

| Scenario | AUTH_MODE | Headers Needed | Expected Result |
|----------|-----------|----------------|-----------------|
| Production | `jwt` | `Authorization: Bearer <token>` | JWT validated |
| Quick testing | `test` + `TEST_USER_ID` | None | Auto user |
| Multi-user testing | `test` | `x-test-user-id: <uuid>` | Dynamic user |
| Local dev | `disabled` | None | Mock user |
| Public routes | Any | None | Always allowed |

## Benefits

### For Development
- Fast iteration without JWT setup
- Easy user switching
- No authentication complexity during initial development

### For Testing
- Test with different user IDs easily
- No need to generate JWT tokens
- API testing is straightforward

### For Production
- Full JWT security when needed
- Easy to enforce by setting `AUTH_MODE=jwt`
- Clear logging for debugging

### For Debugging JWT
- Keep JWT mode on
- Enhanced error messages
- Detailed logging

## Migration Notes

If you have existing code using `@UseGuards(AuthGuard)`:

1. **Remove** `@UseGuards(AuthGuard)` from controllers (it's now global)
2. **Add** `@Public()` to routes that should be public
3. **Update** `.env` with `AUTH_MODE` setting
4. **Test** that authentication works as expected

## Security Warnings

### ⚠️ Test Mode
- Bypasses all JWT validation
- Use only in development/testing
- Never deploy with `AUTH_MODE=test` to production

### ⚠️ Disabled Mode
- Completely disables authentication
- Use only on local machine
- **NEVER use in production or staging**

### ✅ JWT Mode
- Safe for all environments
- Enforces token validation
- Recommended for production

## Next Steps

1. Set `AUTH_MODE` in your `.env` file
2. Restart the server
3. Check logs to confirm the mode
4. Test the authentication with your preferred method
5. Review `AUTHENTICATION_GUIDE.md` for detailed usage

---

**Quick Start:** See `AUTH_QUICK_START.md`
**Full Guide:** See `AUTHENTICATION_GUIDE.md`
