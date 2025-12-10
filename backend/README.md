# Cloud Fire Alarm - MongoDB Backend

Backend API for the Cloud Fire Alarm system using MongoDB Atlas.

## Features
- Email/Password authentication with email verification
- Google OAuth sign-in
- JWT token-based sessions
- WebSocket for real-time sensor data
- Web Push notifications for mobile alerts
- REST API for device control

## Quick Setup

### 1. MongoDB Atlas Setup
1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a free account and cluster
3. Create a database user (Database Access)
4. Whitelist your IP (Network Access) - use `0.0.0.0/0` for all IPs
5. Get your connection string (Connect > Drivers)

### 2. Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable "Google+ API" 
4. Go to Credentials > Create Credentials > OAuth Client ID
5. Application type: Web application
6. Add authorized JavaScript origins:
   - `http://localhost:5500` (development)
   - Your production URL
7. Copy the Client ID

### 3. Generate VAPID Keys (for Push Notifications)
```bash
npx web-push generate-vapid-keys
```

### 4. Gmail App Password (for emails)
1. Enable 2FA on your Google account
2. Go to Google Account > Security > App passwords
3. Generate a new app password for "Mail"

### 5. Configure Environment
```bash
cp .env.example .env
# Edit .env with your values
```

### 6. Install & Run
```bash
npm install
npm run dev
```

## API Endpoints

### Auth
- `POST /api/auth/register` - Register with email/password
- `POST /api/auth/login` - Login
- `POST /api/auth/google` - Google OAuth login
- `GET /api/auth/verify/:token` - Verify email
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `GET /api/auth/me` - Get current user

### Device
- `GET /api/device/:deviceId` - Get device data
- `POST /api/device/:deviceId/data` - Update sensor data (from ESP32)
- `GET /api/device/:deviceId/commands` - Get pending commands (for ESP32)
- `POST /api/device/:deviceId/command` - Send command to device
- `GET /api/device/:deviceId/history` - Get alarm history
- `DELETE /api/device/:deviceId/history` - Clear history

### Push Notifications
- `GET /api/push/vapid-key` - Get VAPID public key
- `POST /api/push/subscribe` - Subscribe to push
- `POST /api/push/unsubscribe` - Unsubscribe

### WebSocket
- `ws://host/ws/:deviceId` - Real-time data stream

## Deployment

### Railway (Recommended)
1. Push code to GitHub
2. Connect Railway to your repo
3. Add environment variables
4. Deploy!

### Render
1. Create new Web Service
2. Connect GitHub repo
3. Set environment variables
4. Build command: `npm install`
5. Start command: `npm start`
