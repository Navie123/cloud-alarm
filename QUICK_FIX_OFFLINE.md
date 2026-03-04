# Quick Fix: System Offline Issue

## What You're Seeing
- Web dashboard shows "System Offline"
- Browser console shows "Device offline - clearing alarm state"
- Multiple 404 errors in console

## Root Cause
Your ESP32 is not sending data to the server. The web app is connected (WebSocket works), but no sensor data is arriving.

## Immediate Actions

### Step 1: Check ESP32 Serial Monitor (CRITICAL)

1. Connect ESP32 to computer via USB
2. Open Arduino IDE
3. Go to Tools → Serial Monitor
4. Set baud rate to **115200**
5. Press ESP32 reset button

**What to look for:**

✅ **GOOD - ESP32 is working:**
```
=== FireWire Smart Fire Alarm ===
WiFi connected via WiFiManager!
IP: 192.168.x.x
SSID: YourWiFi
Data sent, response: 200
```

❌ **BAD - ESP32 has problems:**
```
WiFi connection failed!
HTTP error: -1
HTTP error: connection refused
Data sent, response: 401  (wrong credentials)
Data sent, response: 404  (device not registered)
```

### Step 2: Fix Authentication Issues (Browser)

The 404 errors in your browser console suggest you're not properly authenticated:

1. **Log out completely:**
   - Click Settings → Logout
   - Clear browser cache (Ctrl+Shift+Delete)
   - Close all FireWire tabs

2. **Log back in:**
   - Go to https://cloud-alarm.onrender.com
   - Enter your Household ID
   - Enter Access Code
   - Enter your name

3. **Verify you're logged in:**
   - You should see your name in the top right
   - Settings should show your household info
   - No 404 errors in console

### Step 3: Verify Device Registration

Your device must be registered in the household. Check MongoDB:

**Using MongoDB Compass or Atlas:**

1. Connect to your MongoDB
2. Find your Household document
3. Check the `devices` array:

```json
{
  "householdId": "your-household-id",
  "devices": [
    {
      "deviceId": "ESP32_001",
      "deviceSecret": "6195d9a4faa9ef076a21eab5810e4ef8",
      "name": "FireWire Sensor"
    }
  ]
}
```

**If device is missing, add it:**

```javascript
// In MongoDB shell or Compass
db.households.updateOne(
  { householdId: "your-household-id" },
  {
    $push: {
      devices: {
        deviceId: "ESP32_001",
        deviceSecret: "6195d9a4faa9ef076a21eab5810e4ef8",
        name: "FireWire Sensor"
      }
    }
  }
)
```

### Step 4: Test Server Endpoint

Test if the server is accepting data:

**Windows PowerShell:**
```powershell
$headers = @{
    "Content-Type" = "application/json"
    "X-Device-Secret" = "6195d9a4faa9ef076a21eab5810e4ef8"
}

$body = @{
    gas = 10
    smoke = 5
    temperature = 25
    humidity = 50
    voltage = 3.3
    threshold = 40
    smokeThreshold = 40
    tempThreshold = 60
    alarm = $false
    timestamp = (Get-Date).ToString()
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://cloud-alarm.onrender.com/api/device/ESP32_001/data" -Method Post -Headers $headers -Body $body
```

**Expected response:**
```json
{"success":true}
```

**If you get an error:**
- 401: Wrong device secret
- 404: Device not registered in household
- 500: Server error (check Render logs)

### Step 5: Re-upload ESP32 Code

If ESP32 Serial Monitor shows errors:

1. **Verify config.h:**
```cpp
#define API_HOST "cloud-alarm.onrender.com"
#define API_PORT 443
#define USE_HTTPS true
#define DEVICE_ID "ESP32_001"
#define DEVICE_SECRET "6195d9a4faa9ef076a21eab5810e4ef8"
```

2. **Upload code:**
```bash
# From project root
cd cloud-alarm/esp32-mongo
# Use Arduino IDE: Sketch → Upload
# Or use the batch file:
../../upload-esp32.bat
```

3. **Wait for upload to complete**
4. **Open Serial Monitor immediately** (115200 baud)
5. **Watch for "Data sent, response: 200"**

### Step 6: Reset WiFi (If WiFi Issues)

If Serial Monitor shows WiFi connection failed:

1. **Hold BOOT button** on ESP32 during startup
2. ESP32 will erase WiFi credentials
3. ESP32 creates "FireWire-Setup" WiFi network
4. Connect to it with password: **firewire123**
5. Configure your WiFi in the captive portal
6. ESP32 restarts and connects

## Common Issues

### Issue: "Data sent, response: 401"
**Cause:** Wrong device secret
**Fix:** Check config.h DEVICE_SECRET matches MongoDB

### Issue: "HTTP error: -1"
**Cause:** Can't reach server (WiFi or DNS issue)
**Fix:** 
- Check WiFi connection
- Verify API_HOST is correct (no http:// prefix)
- Try pinging cloud-alarm.onrender.com

### Issue: "Data sent, response: 404"
**Cause:** Device not registered in household
**Fix:** Add device to household in MongoDB (see Step 3)

### Issue: Render server sleeping
**Cause:** Free tier spins down after 15 min inactivity
**Fix:** 
- First request takes 50 seconds to wake up
- Keep browser tab open
- Consider paid tier for always-on

## Verification Checklist

After fixes, verify:

- [ ] ESP32 Serial Monitor shows "Data sent, response: 200" every 0.25 seconds
- [ ] Web dashboard shows "Connected" (green dot)
- [ ] Sensor readings update in real-time
- [ ] No 404 errors in browser console
- [ ] Temperature, humidity, gas levels display correctly
- [ ] Render logs show POST requests to /api/device/ESP32_001/data

## Still Not Working?

**Collect this information:**

1. **ESP32 Serial Monitor output** (copy full log)
2. **Browser console errors** (F12 → Console tab, screenshot)
3. **Render server logs** (last 50 lines)
4. **MongoDB Household document** (devices array)
5. **Your config.h file** (hide sensitive data)

Then we can diagnose the exact issue.

---

**Most Common Fix:** 
9 out of 10 times, the issue is that the ESP32 isn't connected to WiFi or has the wrong API_HOST. Check Serial Monitor first!
