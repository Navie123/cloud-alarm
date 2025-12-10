# Fresh Firebase Setup Guide

## What's Been Cleaned
✅ All Firebase configuration files removed
✅ ESP32 code preserved (WiFi, sensors, hardware)
✅ HTML/CSS/JS UI preserved
✅ Ready for fresh Firebase setup

## Step 1: Create New Firebase Project

1. Go to https://console.firebase.google.com/
2. Click "Add project" or use existing project
3. Enter project name (e.g., "my-fire-alarm")
4. Follow the setup wizard

## Step 2: Enable Realtime Database

1. In Firebase Console, go to "Realtime Database"
2. Click "Create Database"
3. Choose location: **asia-southeast1** (Singapore)
4. Start in **test mode** for now (we'll add rules later)

## Step 3: Get Firebase Credentials

1. In Firebase Console, click the gear icon → Project settings
2. Scroll down to "Your apps"
3. Click the web icon `</>` to add a web app
4. Register app with a nickname (e.g., "Fire Alarm Web")
5. Copy the config object - you'll need:
   - `apiKey`
   - `authDomain`
   - `databaseURL`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`

## Step 4: Configure ESP32

Edit `cloud-alarm/esp32/src/config.h`:

```cpp
// Replace these with your Firebase project details
#define FIREBASE_HOST "your-project-id-default-rtdb.asia-southeast1.firebasedatabase.app"
#define FIREBASE_API_KEY "your-api-key-here"
```

**Note:** For FIREBASE_HOST, use only the hostname (without https://)

## Step 5: Create Web Config File

Create `cloud-alarm/web/js/config.js`:

```javascript
// Firebase Configuration
const firebaseConfig = {
  apiKey: "YOUR-API-KEY",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "your-project-id",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

// Device ID to monitor (must match ESP32 config)
const DEVICE_ID = "alarm-device-01";

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
```

## Step 6: Create Database Rules

Create `cloud-alarm/web/database.rules.json`:

```json
{
  "rules": {
    "devices": {
      "$deviceId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

## Step 7: Create Firebase Config

Create `cloud-alarm/web/firebase.json`:

```json
{
  "database": {
    "rules": "database.rules.json"
  },
  "hosting": {
    "public": "public",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ]
  }
}
```

## Step 8: Initialize Firebase in Web Directory

```bash
cd cloud-alarm/web
firebase login
firebase init
```

Select:
- Realtime Database
- Hosting

Choose existing project, select your project from the list.

## Step 9: Copy Files to Public Folder

```bash
cd cloud-alarm/web
copy index.html public\index.html
copy css\style.css public\css\style.css
copy js\*.js public\js\
copy 911.mp3 public\911.mp3
```

## Step 10: Deploy to Firebase

```bash
cd cloud-alarm/web
firebase deploy
```

## Step 11: Upload to ESP32

```bash
cd cloud-alarm/esp32/cloud_alarm
.\upload.bat COM4
```

(Replace COM4 with your ESP32 port)

## Step 12: Test

1. Open your Firebase Hosting URL (shown after deploy)
2. Check if ESP32 is sending data to Firebase Console → Realtime Database
3. Verify live data appears on the web dashboard

## Troubleshooting

**ESP32 not connecting:**
- Check WiFi credentials in `config.h`
- Verify Firebase Host format (no https://, no trailing slash)
- Check serial monitor for error messages

**Web app not loading data:**
- Verify all Firebase config values match
- Check browser console for errors
- Ensure DEVICE_ID matches in both ESP32 and web config

**Database permission denied:**
- Update database rules to allow read/write
- Deploy rules: `firebase deploy --only database`

## Security Note

The current rules allow anyone to read/write. For production:
1. Enable Firebase Authentication
2. Update rules to require authentication
3. Add user-specific access controls
