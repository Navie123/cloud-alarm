# FireWire - Smart Fire Alarm System

A cloud-based IoT fire alarm monitoring system with real-time alerts, accessible from anywhere.

## Architecture

```
ESP32 (Sensors) --> Node.js Backend (Render) --> MongoDB Atlas
                           ↓
                    Web Dashboard (Render Static Site)
                           ↓
                    Push Notifications (Web Push API)
```

## Components

1. **ESP32 Firmware** (`esp32-mongo/`) - Reads sensors and sends data to backend API
2. **Node.js Backend** (`backend/`) - REST API server hosted on Render
3. **Web Dashboard** (`web-mongo/`) - Static site hosted on Render

## Tech Stack

- **Hardware**: ESP32 DevKit V1, MQ-2, MQ-7, MQ-135, HDC1080 sensors
- **Backend**: Node.js, Express.js, MongoDB Atlas
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Hosting**: Render.com (Backend + Static Site)
- **Database**: MongoDB Atlas
- **Authentication**: Google OAuth 2.0, PIN-based access

## Features

- Real-time sensor monitoring (Gas, Smoke, CO, Temperature, Humidity, Air Quality)
- Multi-sensor threshold alerts with customizable levels
- Push notifications to registered devices
- Household-based access control (Admin + Family members)
- Alarm history with PDF export
- Local LCD display and buzzer (works offline)
- Secure HTTPS communication
- Mobile-responsive dashboard

## Setup Instructions

### 1. MongoDB Atlas Setup
See [MONGODB_SETUP.md](MONGODB_SETUP.md) for detailed instructions.

### 2. Backend Setup (Render)
1. Create account on [Render.com](https://render.com)
2. Deploy `backend/` as a Web Service
3. Set environment variables (see `backend/.env.example`)
4. See [DEPLOY_GUIDE.md](DEPLOY_GUIDE.md) for details

### 3. Web Dashboard Setup
1. Deploy `web-mongo/` as a Static Site on Render
2. Update API URL in `web-mongo/js/api.js`

### 4. ESP32 Setup
1. Update `esp32-mongo/config.h` with WiFi and API credentials
2. Install required libraries:
   - HTTPClient
   - ArduinoJson
   - ClosedCube HDC1080
3. Upload to ESP32

## Documentation

- [SETUP_GUIDE.md](SETUP_GUIDE.md) - Complete setup instructions
- [DEPLOY_GUIDE.md](DEPLOY_GUIDE.md) - Deployment guide for Render
- [MONGODB_SETUP.md](MONGODB_SETUP.md) - MongoDB Atlas configuration
- [HOUSEHOLD_SETUP.md](HOUSEHOLD_SETUP.md) - Household access setup
- [WIRING_GUIDE.txt](WIRING_GUIDE.txt) - Hardware wiring diagram
- [SECURITY_UPDATES.md](SECURITY_UPDATES.md) - Security features

## Live Demo

Dashboard: https://cloud-alarm.onrender.com

## License

MIT License
