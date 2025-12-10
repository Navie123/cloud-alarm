# Cloud Fire Alarm System

A cloud-based fire alarm monitoring system accessible from anywhere with internet.

## Architecture

```
ESP32 (Sensors) --> Firebase Realtime Database <-- Web Dashboard (anywhere)
```

## Components

1. **ESP32 Firmware** (`esp32/`) - Reads sensors and pushes data to Firebase
2. **Web Dashboard** (`web/`) - Static site hosted on Firebase Hosting

## Setup Instructions

### 1. Firebase Setup
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (e.g., "fire-alarm-system")
3. Enable Realtime Database (Start in test mode for now)
4. Enable Hosting
5. Copy your Firebase config from Project Settings > Web App

### 2. ESP32 Setup
1. Update `esp32/config.h` with your WiFi and Firebase credentials
2. Install required libraries in Arduino IDE:
   - Firebase ESP32 Client by Mobizt
   - ClosedCube HDC1080
3. Upload to ESP32

### 3. Web Dashboard Setup
1. Update `web/js/config.js` with your Firebase config
2. Deploy: `firebase deploy --only hosting`

## Features
- Real-time sensor monitoring from anywhere
- Temperature, humidity, and gas level tracking
- Alarm history with timestamps
- Remote alarm control (silence/arm)
- Push notifications (optional)
- Mobile-responsive design
