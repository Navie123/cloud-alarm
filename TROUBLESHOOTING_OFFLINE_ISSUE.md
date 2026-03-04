# Troubleshooting: System Offline Issue

## Problem
ESP32 is powered on, but the FireWire web dashboard shows "System Offline - Device disconnected"

## Root Cause Analysis

Based on your Render logs showing:
```
[Client] Connected to ESP32_001 (admin: undefined)
WebSocket disconnected: ESP32_001
```

This indicates:
1. ✅ Web browser successfully connected to WebSocket
2. ❌ ESP32 is NOT sending data to the server
3. ❌ Server marks device as offline after 30 seconds of no data

## Diagnostic Steps

### Step 1: Check ESP32 Serial Monitor

1. Open Arduino IDE
2. Connect ESP32 via USB
3. Open Serial Monitor (Tools → Serial Monitor, 115200 baud)
4. Look for these messages:

**Good signs:**
```
WiFi connected via WiFiManager!
IP: 192.168.x.x
SSID: YourWiFiName
Data sent, response: 200
```

**Bad signs:**
```
WiFi connection failed!
HTTP error: connection refused
HTTP error: -1
Failed to connect to server
```

### Step 2: Verify ESP32 Configuration

Check `cloud-alarm/esp32-mongo/config.h`:

```cpp
// Should be:
#define API_HOST "cloud-alarm.onrender.com"
#define API_PORT 443
#define USE_HTTPS true

#define DEVICE_ID "ESP32_001"
#define DEVICE_SECRET "6195d9a4faa9ef076a21eab5810e4ef8"
```

### Step 3: Check Device Registration

The device must be registered in your household. Check MongoDB:

```javascript
// In MongoDB, your Household document should have:
{
  "householdId": "...",
  "devices": [
    {
      "deviceId": "ESP32_001",
      "deviceSecret": "6195d9a4faa9ef076a21eab5810e4ef8",
      "name": "FireWire Sensor"
    }
  ]
}
```

### Step 4: Test HTTP POST Manually

From your computer, test if the server accepts data:

```bash
curl -X POST https://cloud-alarm.onrender.com/api/device/ESP32_001/data \
  -H "Content-Type: application/json" \
  -H "X-Device-Secret: 6195d9a4faa9ef076a21eab5810e4ef8" \
  -d '{
    "gas": 10,
    "smoke": 5,
    "temperature": 25,
    "humidity": 50,
    "voltage": 3.3,
    "threshold": 40,
    "smokeThreshold": 40,
    "tempThreshold": 60,
    "alarm": false,
    "timestamp": "2024-02-24 11:00:00"
  }'
```

**Expected response:**
```json
{"success":true}
```

## Common Issues & Solutions

### Issue 1: WiFi Not Connected

**Symptoms:**
- Serial Monitor shows "WiFi connection failed"
- ESP32 LED blinking rapidly

**Solution:**
1. Hold BOOT button during ESP32 startup to reset WiFi
2. Connect to "FireWire-Setup" WiFi network (password: firewire123)
3. Configure your WiFi credentials in the captive portal
4. ESP32 will restart and connect

### Issue 2: Wrong API Host

**Symptoms:**
- Serial Monitor shows "HTTP error: -1" or "connection refused"

**Solution:**
Check `config.h` has correct production settings:
```cpp
#define API_HOST "cloud-alarm.onrender.com"  // NO http:// or https://
#define USE_HTTPS true
```

### Issue 3: Invalid Device Credentials

**Symptoms:**
- Serial Monitor shows "Data sent, response: 401"
- Render logs show "Invalid device credentials"

**Solution:**
1. Verify DEVICE_SECRET in `config.h` matches MongoDB
2. Check household has device registered
3. Re-upload ESP32 code after fixing

### Issue 4: Render Server Sleeping

**Symptoms:**
- First HTTP request takes 50+ seconds
- Render logs show "Your free instance will spin down with inactivity"

**Solution:**
- Render free tier spins down after 15 minutes of inactivity
- First request wakes it up (takes ~50 seconds)
- Keep browser tab open to maintain WebSocket connection
- Consider upgrading to paid tier for always-on service

### Issue 5: SSL/TLS Certificate Issues

**Symptoms:**
- Serial Monitor shows "SSL handshake failed"
- HTTP error codes related to certificates

**Solution:**
In ESP32 code, we use `wifiClientSecure.setInsecure()` which bypasses certificate validation. This is already set in your code.

## Quick Fix Checklist

- [ ] ESP32 is powered on and LED is solid (not blinking)
- [ ] Serial Monitor shows "WiFi connected"
- [ ] Serial Monitor shows "Data sent, response: 200"
- [ ] `config.h` has correct API_HOST and DEVICE_SECRET
- [ ] Device is registered in MongoDB household
- [ ] Render server is awake (check logs for recent activity)
- [ ] Web dashboard is logged in with valid session
- [ ] Browser console shows no WebSocket errors

## Testing Data Flow

### 1. ESP32 → Server (HTTP POST)
```
ESP32 reads sensors every 0.25 seconds
  ↓
Sends JSON via HTTPS POST to /api/device/ESP32_001/data
  ↓
Server validates device secret
  ↓
Server saves to MongoDB Device collection
  ↓
Server broadcasts to WebSocket clients
```

### 2. Server → Web Dashboard (WebSocket)
```
Browser connects to wss://cloud-alarm.onrender.com/ws/ESP32_001?token=xxx
  ↓
Server validates session token
  ↓
Server sends real-time data updates
  ↓
Dashboard updates UI with sensor readings
```

## Expected Serial Monitor Output

```
=== FireWire Smart Fire Alarm ===
WiFi connected via WiFiManager!
IP: 192.168.1.100
SSID: YourWiFi
Signal: -45 dBm
HDC1080 initialized - Temp: 25.0°C, Hum: 50.0%
Fetching thresholds from server...
[CMD] Checking commands... HTTP 200
After server sync - Gas: 40%, Smoke: 40%, Temp: 60°C
Sensors ready - showing real-time readings

Raw ADC - MQ2: 450, MQ7: 420, MQ135: 480 -> Smoke: 11.0%, Gas: 10.3%, AQI: 45
CO: 0.0 PPM (normal), AQI: 45 (good), Temp: 25.1°C, Hum: 50.2%
Data sent, response: 200

[Repeats every 0.25 seconds]
```

## If Still Not Working

1. **Check Render Logs** (https://dashboard.render.com)
   - Look for POST requests to `/api/device/ESP32_001/data`
   - Check for error messages

2. **Check Browser Console** (F12 → Console tab)
   - Look for WebSocket connection errors
   - Check for authentication errors

3. **Verify MongoDB Data**
   - Check if Device document is being updated
   - Look at `lastSeen` timestamp

4. **Re-upload ESP32 Code**
   ```bash
   # From project root
   ./upload-esp32.bat
   ```

5. **Factory Reset ESP32**
   - Hold BOOT button during startup
   - Reconfigure WiFi
   - Re-upload code

## Contact Information

If issue persists, provide:
1. Serial Monitor output (full log)
2. Render server logs (last 50 lines)
3. Browser console errors
4. MongoDB Device document for ESP32_001

---

**Last Updated:** February 24, 2026
