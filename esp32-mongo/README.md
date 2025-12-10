# ESP32 Firmware - MongoDB Backend Version

Updated ESP32 firmware that sends data to the Node.js/MongoDB backend instead of Firebase.

## Changes from Firebase Version

- Uses HTTP POST to send sensor data
- Uses HTTP GET to receive commands
- No Firebase SDK required
- Simpler, smaller code

## Setup

1. **Edit `config.h`**:
   ```cpp
   #define WIFI_SSID "your-wifi-name"
   #define WIFI_PASSWORD "your-wifi-password"
   #define API_HOST "192.168.1.100"  // Your backend IP
   #define API_PORT 3000
   #define DEVICE_ID "ESP32_001"
   ```

2. **For Production**:
   ```cpp
   #define API_HOST "your-backend.railway.app"
   #define API_PORT 443
   #define USE_HTTPS true
   ```

3. **Upload to ESP32** using Arduino IDE or PlatformIO

## Required Libraries

- ArduinoJson (v6.x)
- ClosedCube_HDC1080

## Wiring

| Component | ESP32 Pin |
|-----------|-----------|
| MQ2 AO    | GPIO 34   |
| Buzzer    | GPIO 25   |
| LED       | GPIO 2    |
| HDC1080 SDA | GPIO 21 |
| HDC1080 SCL | GPIO 22 |

## API Endpoints Used

- `POST /api/device/{deviceId}/data` - Send sensor readings
- `GET /api/device/{deviceId}/commands` - Get pending commands

## Data Format Sent

```json
{
  "gas": 25.5,
  "temperature": 28.3,
  "humidity": 65.2,
  "voltage": 3.28,
  "threshold": 40,
  "tempThreshold": 60,
  "alarm": false,
  "tempWarning": "normal",
  "sirenEnabled": true,
  "heap": 245000,
  "timestamp": "12:34:56"
}
```

## Commands Received

```json
{
  "threshold": 45,
  "tempThreshold": 65,
  "sirenEnabled": false,
  "silence": true
}
```
