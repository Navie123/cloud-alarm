# MongoDB Atlas Migration Guide

Complete guide to migrate from Firebase to MongoDB Atlas.

## Overview

This migration replaces:
- Firebase Auth → Custom JWT auth + Google OAuth
- Firebase Realtime Database → MongoDB Atlas
- Firebase Hosting → Any static host (Vercel, Netlify, etc.)

## Project Structure

```
cloud-alarm/
├── backend/              # Node.js API server
│   ├── models/           # MongoDB schemas
│   ├── routes/           # API routes
│   ├── middleware/       # Auth middleware
│   ├── utils/            # Email, push utilities
│   ├── server.js         # Main server
│   └── package.json
│
├── web-mongo/            # Updated frontend
│   ├── js/
│   │   ├── config.js     # API URLs, Device ID
│   │   ├── api.js        # API helper functions
│   │   ├── auth.js       # Authentication
│   │   ├── push.js       # Push notifications
│   │   └── app.js        # Main app logic
│   ├── css/style.css
│   ├── sw.js             # Service worker for push
│   ├── index.html
│   └── manifest.json
│
└── esp32/                # ESP32 firmware (needs update)
```

## Step-by-Step Setup

### Step 1: MongoDB Atlas

1. **Create Account**: https://www.mongodb.com/atlas
2. **Create Free Cluster** (M0 Sandbox - free forever)
3. **Database Access**: Create user with read/write permissions
4. **Network Access**: Add `0.0.0.0/0` to allow all IPs
5. **Get Connection String**: 
   - Click "Connect" > "Drivers"
   - Copy the connection string
   - Replace `<password>` with your database user password

### Step 2: Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project: "Cloud Fire Alarm"
3. APIs & Services > OAuth consent screen:
   - User Type: External
   - App name: Cloud Fire Alarm
   - Add your email
4. Credentials > Create Credentials > OAuth Client ID:
   - Application type: Web application
   - Authorized JavaScript origins:
     - `http://localhost:5500`
     - `http://127.0.0.1:5500`
     - Your production URL
5. Copy the **Client ID**

### Step 3: VAPID Keys (Push Notifications)

Run in the backend folder:
```bash
cd cloud-alarm/backend
npx web-push generate-vapid-keys
```

Save both keys - you'll need them for `.env`

### Step 4: Gmail App Password

1. Go to Google Account > Security
2. Enable 2-Step Verification
3. Go to App passwords
4. Select "Mail" and generate
5. Copy the 16-character password

### Step 5: Configure Backend

```bash
cd cloud-alarm/backend
copy .env.example .env
```

Edit `.env`:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/cloud-alarm
JWT_SECRET=generate-a-random-32-char-string
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_EMAIL=mailto:your@email.com
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your@gmail.com
EMAIL_PASS=your-app-password
PORT=3000
FRONTEND_URL=http://localhost:5500
```

### Step 6: Install & Run Backend

```bash
cd cloud-alarm/backend
npm install
npm run dev
```

You should see:
```
Connected to MongoDB Atlas
Server running on port 3000
```

### Step 7: Configure Frontend

Edit `cloud-alarm/web-mongo/js/config.js`:
```javascript
const CONFIG = {
  API_URL: 'http://localhost:3000',
  WS_URL: 'ws://localhost:3000',
  DEVICE_ID: 'ESP32_001',  // Match your ESP32
  GOOGLE_CLIENT_ID: 'your-client-id.apps.googleusercontent.com'
};
```

### Step 8: Run Frontend

Use VS Code Live Server or any static server:
- Right-click `index.html` > "Open with Live Server"
- Or: `npx serve cloud-alarm/web-mongo`

### Step 9: Update ESP32 Firmware

The ESP32 needs to send data to your new backend instead of Firebase.
See `esp32/README.md` for updated firmware.

## Deployment

### Backend (Railway - Free)

1. Push to GitHub
2. Go to [Railway](https://railway.app)
3. New Project > Deploy from GitHub
4. Add environment variables
5. Get your URL (e.g., `https://your-app.railway.app`)

### Frontend (Vercel - Free)

1. Go to [Vercel](https://vercel.com)
2. Import `web-mongo` folder
3. Deploy
4. Update `config.js` with production URLs

### Update Config for Production

`web-mongo/js/config.js`:
```javascript
const CONFIG = {
  API_URL: 'https://your-backend.railway.app',
  WS_URL: 'wss://your-backend.railway.app',
  DEVICE_ID: 'ESP32_001',
  GOOGLE_CLIENT_ID: 'your-client-id.apps.googleusercontent.com'
};
```

## Testing

1. Open frontend in browser
2. Register a new account
3. Check email for verification link
4. Sign in
5. Test Google sign-in
6. Enable push notifications
7. Test with ESP32 or simulate data

## Simulating ESP32 Data

For testing without hardware, use curl:
```bash
curl -X POST http://localhost:3000/api/device/ESP32_001/data \
  -H "Content-Type: application/json" \
  -d '{"gas":25,"temperature":28,"humidity":65,"voltage":3.3,"threshold":40,"tempThreshold":60,"alarm":false}'
```

## Troubleshooting

**MongoDB Connection Failed**
- Check connection string format
- Verify IP whitelist includes your IP
- Check database user credentials

**Google Sign-In Not Working**
- Verify Client ID matches
- Check authorized origins include your URL
- Clear browser cache

**Push Notifications Not Working**
- Check VAPID keys are correct
- Ensure HTTPS in production
- Check browser permissions

**WebSocket Disconnecting**
- Backend might be sleeping (free tier)
- Check CORS settings
- Verify WS URL is correct
