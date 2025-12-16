# Cloud Fire Alarm - Household Access System

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLOUD SERVER (Render)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │  Household  │  │   Device    │  │   Session   │                 │
│  │   Model     │  │   Model     │  │   Tokens    │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
│         │               │                │                          │
│  ┌──────┴───────────────┴────────────────┴──────┐                  │
│  │              WebSocket Server                 │                  │
│  │  - Verify access code before connection       │                  │
│  │  - Verify device_id + secret for ESP32        │                  │
│  │  - Require admin PIN for critical actions     │                  │
│  └───────────────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
         ▲                                    ▲
         │ WebSocket                          │ WebSocket
         │ (device_id + secret)               │ (session token)
         │                                    │
    ┌────┴────┐                         ┌─────┴─────┐
    │  ESP32  │                         │  Family   │
    │ Device  │                         │  Members  │
    └─────────┘                         └───────────┘
    (Runs independently)                (View + Admin controls)
```

## Security Model

### Access Levels

| Role | Access Code | Admin PIN | Capabilities |
|------|-------------|-----------|--------------|
| Family Member | ✅ Required | ❌ Not needed | View dashboard, change personal alarm sound |
| Admin | ✅ Required | ✅ Required | All member features + change thresholds, silence alarm, clear history |

### Authentication Flow

1. **Family Member Access:**
   - Enter 6-digit household access code
   - Receive session token (valid 30 days)
   - Can view real-time data and history
   - Can change personal alarm sound preference

2. **Admin Actions:**
   - Must first join with access code
   - Enter 4-digit admin PIN for critical actions
   - PIN required for: threshold changes, silence alarm, toggle siren, clear history

3. **ESP32 Device:**
   - Uses device_id + device_secret for authentication
   - Secret is generated when device is registered
   - Must be hardcoded in ESP32 firmware

## Setup Instructions

### 1. Create Your Household

Make a POST request to create your household:

```bash
curl -X POST https://your-server.com/api/household/setup \
  -H "Content-Type: application/json" \
  -d '{
    "householdName": "Dela Cruz Family",
    "deviceId": "ESP32_001",
    "adminEmail": "admin@example.com"
  }'
```

Response:
```json
{
  "success": true,
  "householdId": "abc123def456",
  "accessCode": "123456",
  "adminPin": "1234",
  "deviceSecret": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
}
```

**⚠️ SAVE THESE CREDENTIALS SECURELY!**
- `accessCode`: Share with family members
- `adminPin`: Keep private (admin only)
- `deviceSecret`: Program into ESP32

### 2. Configure ESP32

Update your ESP32 `config.h`:

```cpp
#define DEVICE_ID "ESP32_001"
#define DEVICE_SECRET "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
#define SERVER_URL "wss://your-server.com/ws"
```

### 3. Share Access Code

Give the 6-digit access code to family members. They enter it on the dashboard to view the alarm status.

### 4. Admin Controls

When performing admin actions (changing thresholds, silencing alarm), you'll be prompted for the 4-digit admin PIN.

## API Endpoints

### Public
- `POST /api/household/setup` - Create new household
- `POST /api/household/join` - Join with access code

### Member (requires session token)
- `GET /api/household/info` - Get household info
- `GET /api/household/preferences/:memberId` - Get member preferences
- `PUT /api/household/preferences/:memberId` - Update preferences
- `POST /api/household/logout` - End session
- `GET /api/device/:deviceId` - Get device data
- `GET /api/device/:deviceId/history` - Get alarm history

### Admin (requires session + PIN)
- `POST /api/household/verify-pin` - Verify admin PIN
- `PUT /api/household/access-code` - Change access code
- `PUT /api/household/admin-pin` - Change admin PIN
- `POST /api/device/:deviceId/command` - Send command
- `POST /api/device/:deviceId/silence` - Silence alarm
- `DELETE /api/device/:deviceId/history` - Clear history

## Safety Guarantees

✅ **Fire detection runs 100% on hardware**
- Alarm triggers based on local sensor readings
- Buzzer and LED activate without internet
- No server dependency for safety functions

✅ **Dashboard is monitoring only**
- Cannot disable hardware alarm
- Can only silence web/app notifications
- ESP32 continues operating if server is down

## Future Upgrade Path

To add full user accounts later:
1. Add User model with email/password
2. Link users to households
3. Add role-based permissions per user
4. Keep household access code as fallback
