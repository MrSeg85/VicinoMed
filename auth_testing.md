# Auth Testing Playbook (VicinoMed)

This is an auth-gated app with both Email/Password (JWT) and Emergent Google Auth.

## Step 1: Test Email/Password Auth (no DB seed needed)

Register:
```
curl -X POST "$EXPO_PUBLIC_BACKEND_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"mario.rossi@test.it","password":"Password123","name":"Mario Rossi","role":"patient"}'
```

Login:
```
curl -X POST "$EXPO_PUBLIC_BACKEND_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"mario.rossi@test.it","password":"Password123"}'
```
Returns `{ session_token, user }`.

## Step 2: Test Google Auth (Manual via Mongo seed)

Create test user & session:
```
mongosh --eval "
use('test_database');
var visitorId = 'user_' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: visitorId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  role: 'patient',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: visitorId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Token: ' + sessionToken);
"
```

## Step 3: Auth Header
Backend accepts `Authorization: Bearer <token>` for both JWT and Emergent session tokens.

## Step 4: Browser Testing
Set cookie:
```javascript
await page.context.add_cookies([{
    "name": "session_token",
    "value": "TOKEN",
    "domain": "vicino-med.preview.emergentagent.com",
    "path": "/",
    "httpOnly": true,
    "secure": true,
    "sameSite": "None"
}]);
```

## Test Identity Tracking
See `/app/memory/test_credentials.md` for active test accounts.
