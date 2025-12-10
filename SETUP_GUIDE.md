# Cloud Fire Alarm - Setup Guide

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Name it (e.g., "fire-alarm-cloud")
4. Disable Google Analytics (optional)
5. Click "Create project"

## Step 2: Enable Realtime Database

1. In Firebase Console, go to "Build" → "Realtime Database"
2. Click "Create Database"
3. Choose your region (closest to you)
4. Select "Start in test mode" (we'll secure it later)
5. Click "Enable"

## Step 3: Get Firebase Configuration

1. Go to Project Settings (gear icon)
2. Scroll down to "Your apps"
3. Click the web icon `</>`
4. Register app with a nickname (e.g., "fire-alarm-web")
5. Copy the `firebaseConfig` object

## Step 4: Configure Web Dashboard

Edit `web/js/config.js` and replace with your Firebase config:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

## Step 5: Configure ESP32

Edit `esp32/config.h`:

```cpp
#define WIFI_SSID "Your_WiFi_Name"
#define WIFI_PASSWORD "Your_WiFi_Password"

#define FIREBASE_HOST "your-project-default-rtdb.firebaseio.com"
#define FIREBASE_API_KEY "AIzaSy..."
```

## Step 6: Build & Upload ESP32 Code (PlatformIO)

The ESP32 code is set up as a PlatformIO project. Libraries are auto-installed.

1. Open the `cloud-alarm/esp32` folder in VS Code/Kiro
2. Edit `src/config.h` with your WiFi and Firebase credentials
3. Build and upload:

```bash
cd cloud-alarm/esp32
pio run --target upload
```

Or use the PlatformIO toolbar buttons in VS Code.

## Step 8: Deploy Web Dashboard

### Option A: Firebase Hosting (Recommended)

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Initialize in the `web` folder:
   ```bash
   cd cloud-alarm/web
   firebase init hosting
   ```
   - Select your project
   - Use `.` as public directory
   - Configure as single-page app: Yes

4. Deploy:
   ```bash
   firebase deploy --only hosting
   ```

5. Your dashboard is now live at: `https://your-project.web.app`

### Option B: Any Static Host

The `web` folder is a static site. You can host it on:
- GitHub Pages
- Netlify
- Vercel
- Any web server

Just upload the contents of the `web` folder.

## Step 9: Test It!

1. Power on your ESP32
2. Open your dashboard URL
3. You should see real-time sensor data!

## Troubleshooting

### ESP32 not connecting to Firebase
- Check WiFi credentials
- Verify Firebase URL (should NOT have `https://`)
- Check API key

### Dashboard shows "Disconnected"
- Verify Firebase config in `config.js`
- Check browser console for errors
- Ensure database rules allow read/write

### No sensor data
- Check ESP32 serial monitor for errors
- Verify sensor wiring
- Check if data appears in Firebase Console → Realtime Database

## Security (Important for Production!)

After testing, update your database rules in Firebase Console:

```json
{
  "rules": {
    "devices": {
      "$deviceId": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    }
  }
}
```

Then implement Firebase Authentication in both ESP32 and web app.
