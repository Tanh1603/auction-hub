# Authentication System Guide

## Overview

The server now has a **flexible global authentication system** that can be easily configured for different environments. The authentication guard is applied globally to all routes by default, with options to bypass it for specific routes or change authentication modes.

## Authentication Modes

The system supports three authentication modes controlled by the `AUTH_MODE` environment variable:

### 1. JWT Mode (Production) - `AUTH_MODE=jwt`

**Use this for production and when testing with real JWT tokens.**

- Requires valid JWT Bearer token in the `Authorization` header
- Verifies tokens using `SUPABASE_JWT_SECRET` or `JWT_SECRET`
- Full authentication and authorization
- Token expiration is enforced

**Example Request:**
```bash
curl -H "Authorization: Bearer eyJhbGc..." http://localhost:3000/api/auctions
```

### 2. Test Mode - `AUTH_MODE=test`

**Use this for testing and development when you want to bypass JWT verification.**

Two ways to use test mode:

#### Option A: Using x-test-user-id Header (Dynamic)
Send a `x-test-user-id` header with each request:

```bash
curl -H "x-test-user-id: 550e8400-e29b-41d4-a716-446655440000" \
     http://localhost:3000/api/auctions
```

#### Option B: Using TEST_USER_ID Environment Variable (Static)
Set `TEST_USER_ID` in your `.env` file:

```env
AUTH_MODE=test
TEST_USER_ID=550e8400-e29b-41d4-a716-446655440000
TEST_USER_ROLE=admin
```

Now all requests automatically use this user ID without needing headers:

```bash
curl http://localhost:3000/api/auctions
# Automatically uses TEST_USER_ID from .env
```

**Note:** If `x-test-user-id` header is provided, it takes precedence over `TEST_USER_ID`.

### 3. Disabled Mode - `AUTH_MODE=disabled`

**Use this only for local development when you want to completely disable authentication.**

- No authentication required at all
- Uses mock user data from environment variables
- **⚠️ WARNING: Never use this in production!**

```env
AUTH_MODE=disabled
TEST_USER_ID=test-user-id
TEST_USER_ROLE=user
```

## Environment Configuration

Add these to your `.env` file:

```env
# Authentication Mode Configuration
# Options: 'jwt', 'test', 'disabled'
AUTH_MODE=jwt

# Test User Configuration (when AUTH_MODE=test or disabled)
TEST_USER_ID=550e8400-e29b-41d4-a716-446655440000
TEST_USER_ROLE=user
```

### Available Roles

- `user` - Regular user
- `auctioneer` - Can manage auctions
- `admin` - Full admin access
- `super_admin` - Super administrator

## Making Routes Public

By default, all routes require authentication. To make a route public (bypass authentication), use the `@Public()` decorator:

```typescript
import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';

@Controller('status')
export class StatusController {
  @Public()
  @Get()
  getStatus() {
    return { status: 'ok' };
  }

  @Get('admin')
  getAdminStatus() {
    // This route requires authentication
    return { status: 'admin ok' };
  }
}
```

## Usage Examples

### Scenario 1: Testing JWT Issues

When investigating JWT problems, use JWT mode with verbose logging:

```env
AUTH_MODE=jwt
```

Run the server and check the logs. The AuthGuard will log JWT verification failures with detailed error messages.

### Scenario 2: Quick API Testing Without JWT

When you want to test endpoints quickly without dealing with JWT tokens:

```env
AUTH_MODE=test
TEST_USER_ID=your-user-uuid
TEST_USER_ROLE=admin
```

Now you can make requests without any headers:

```bash
# All these work without authentication headers
curl http://localhost:3000/api/auctions
curl http://localhost:3000/api/register-to-bid/admin/registrations
```

### Scenario 3: Testing with Different Users

When you need to test with different user IDs dynamically:

```env
AUTH_MODE=test
```

Then switch users by changing the header:

```bash
# Test as user 1
curl -H "x-test-user-id: user-1-uuid" http://localhost:3000/api/auctions

# Test as user 2
curl -H "x-test-user-id: user-2-uuid" http://localhost:3000/api/auctions
```

### Scenario 4: Production Deployment

```env
AUTH_MODE=jwt
SUPABASE_JWT_SECRET=your-production-secret
```

All requests must include valid JWT tokens.

## Postman / API Client Setup

### For JWT Mode

1. Set `AUTH_MODE=jwt` in your `.env`
2. In Postman:
   - Authorization Type: Bearer Token
   - Token: `<your-jwt-token>`

### For Test Mode (Dynamic Users)

1. Set `AUTH_MODE=test` in your `.env`
2. In Postman:
   - Go to Headers tab
   - Add header: `x-test-user-id: <user-uuid>`
   - No Authorization header needed

### For Test Mode (Fixed User)

1. Set in `.env`:
   ```env
   AUTH_MODE=test
   TEST_USER_ID=<your-user-uuid>
   TEST_USER_ROLE=admin
   ```
2. In Postman:
   - No headers needed
   - No Authorization needed
   - All requests use the configured test user

## How It Works

### Global Auth Guard

The AuthGuard is registered globally in `app.module.ts`:

```typescript
{
  provide: APP_GUARD,
  useClass: AuthGuard,
}
```

This means it applies to **all routes by default**.

### Authentication Flow

```
Request → Global AuthGuard → Check if @Public() → Check AUTH_MODE
                                     ↓                    ↓
                                  Allowed         jwt/test/disabled
                                                         ↓
                                              Validate accordingly
                                                         ↓
                                              Attach user to request
                                                         ↓
                                              @CurrentUser decorator
                                                         ↓
                                              Your controller
```

### Logging

The AuthGuard logs authentication events:

- **JWT Mode**: Logs JWT verification success/failure
- **Test Mode**: Warns about test user being used
- **Disabled Mode**: Warns that auth is completely disabled

Look for these in your console:

```
[AuthGuard] Auth mode: test
[AuthGuard] ⚠️  TEST MODE - Using test user ID: 550e8400-...
```

## Security Considerations

### ⚠️ Production

- **Always use `AUTH_MODE=jwt` in production**
- Never commit `.env` files with real credentials
- Rotate JWT secrets regularly
- Monitor authentication logs

### ⚠️ Test/Development

- Test mode bypasses all JWT validation - use carefully
- Don't use test mode on publicly accessible servers
- Document which mode you're using in your local setup

### ⚠️ Disabled Mode

- **Never use in production or staging**
- Only use on your local development machine
- This mode is insecure and meant only for rapid local development

## Troubleshooting

### "Authorization header is missing"

**In JWT mode:**
- Add a Bearer token: `Authorization: Bearer <token>`

**In test mode:**
- Add header: `x-test-user-id: <uuid>`
- Or set `TEST_USER_ID` in `.env`

### "Invalid token" or JWT Verification Errors

1. Check that `SUPABASE_JWT_SECRET` or `JWT_SECRET` is set correctly
2. Verify the token hasn't expired
3. Ensure the token was signed with the same secret
4. Check the token format (should be JWT)
5. Review server logs for detailed error messages

### "User not found in request"

This means the AuthGuard didn't populate the user. Check:
1. Is the global AuthGuard registered in `app.module.ts`?
2. What is the current `AUTH_MODE`?
3. Check server logs for AuthGuard warnings/errors

### Switching Between Modes Not Working

1. Restart the server after changing `AUTH_MODE` in `.env`
2. Verify the `.env` file is being loaded (check startup logs)
3. Make sure `ConfigModule.forRoot()` has `isGlobal: true`

## Quick Reference

| Mode | Use Case | Required Headers | User Source |
|------|----------|------------------|-------------|
| `jwt` | Production, JWT testing | `Authorization: Bearer <token>` | JWT payload |
| `test` | Development, API testing | `x-test-user-id: <uuid>` (optional) | Header or TEST_USER_ID |
| `disabled` | Local dev only | None | TEST_USER_ID or mock |

## Files Modified

- `server/src/common/guards/auth.guard.ts` - Enhanced with mode support
- `server/src/app/app.module.ts` - Global guard registration
- `server/src/common/decorators/current-user.decorator.ts` - Simplified
- `server/src/common/decorators/public.decorator.ts` - New decorator
- `server/.env.example` - Added AUTH_MODE configuration

## Example Commands

```bash
# Test with JWT mode (production-like)
AUTH_MODE=jwt npm start

# Test with test mode + dynamic users
AUTH_MODE=test npm start
curl -H "x-test-user-id: 550e8400-e29b-41d4-a716-446655440000" http://localhost:3000/api/auctions

# Test with test mode + fixed user
AUTH_MODE=test TEST_USER_ID=550e8400-e29b-41d4-a716-446655440000 npm start
curl http://localhost:3000/api/auctions

# Development with no auth (⚠️ local only)
AUTH_MODE=disabled npm start
curl http://localhost:3000/api/auctions
```

## Next Steps

After setting up authentication:

1. Choose your auth mode in `.env`
2. Restart the server
3. Check the startup logs to confirm the mode
4. Test a protected endpoint
5. Review the logs to see authentication in action

For role-based access control, use the `@Roles()` decorator along with `RolesGuard`.
