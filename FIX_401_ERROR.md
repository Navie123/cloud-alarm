# Fix: HTTP 401 Unauthorized Error

## Problem Identified ✅

Your ESP32 Serial Monitor shows:
```
Data sent, response: 401
[CMD] Checking commands... HTTP 401
```

**This means:** The device credentials are being rejected by the server.

## Root Cause

The server checks if the device exists in a household with matching credentials:

```javascript
// Server checks:
const household = await Household.findOne({
  'devices.deviceId': 'ESP32_001',
  'devices.deviceSecret': '6195d9a4faa9ef076a21eab5810e4ef8'
});

if (!household) {
  return res.status(401).json({ error: 'Invalid device credentials' });
}
```

If no household has this device with this secret, you get 401.

## Solution: Register Device in Household

### Option 1: Using MongoDB Compass/Atlas (Recommended)

1. **Open MongoDB Compass or Atlas**
2. **Connect to your database**
3. **Find your Household collection**
4. **Find YOUR household document** (the one you're logged into)
5. **Check if `devices` array exists and has ESP32_001**

**If devices array is empty or missing ESP32_001:**

Click "Edit Document" and add:

```json
{
  "_id": "...",
  "householdId": "your-household-id",
  "accessCode": "your-code",
  "admin": { ... },
  "devices": [
    {
      "deviceId": "ESP32_001",
      "deviceSecret": "6195d9a4faa9ef076a21eab5810e4ef8",
      "name": "FireWire Sensor",
      "location": "Kitchen"
    }
  ],
  "members": [ ... ]
}
```

### Option 2: Using MongoDB Shell

```javascript
// Connect to MongoDB
mongosh "your-connection-string"

// Find your household
db.households.findOne({ householdId: "your-household-id" })

// Add device to household
db.households.updateOne(
  { householdId: "your-household-id" },
  {
    $set: {
      devices: [
        {
          deviceId: "ESP32_001",
          deviceSecret: "6195d9a4faa9ef076a21eab5810e4ef8",
          name: "FireWire Sensor",
          location: "Kitchen"
        }
      ]
    }
  }
)

// Verify it was added
db.households.findOne(
  { householdId: "your-household-id" },
  { devices: 1 }
)
```

### Option 3: Using Backend API (If you have admin access)

Create a temporary route in your backend to register the device:

**Add to `cloud-alarm/backend/server.js`:**

```javascript
// Temporary device registration endpoint (REMOVE AFTER USE)
app.post('/api/admin/register-device', async (req, res) => {
  try {
    const { householdId, deviceId, deviceSecret } = req.body;
    
    const household = await Household.findOne({ householdId });
    if (!household) {
      return res.status(404).json({ error: 'Household not found' });
    }
    
    // Check if device already exists
    const existingDevice = household.devices.find(d => d.deviceId === deviceId);
    if (existingDevice) {
      return res.json({ message: 'Device already registered', device: existingDevice });
    }
    
    // Add device
    household.devices.push({
      deviceId,
      deviceSecret,
      name: 'FireWire Sensor',
      location: 'Kitchen'
    });
    
    await household.save();
    
    res.json({ success: true, message: 'Device registered successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

Then call it:

```bash
curl -X POST https://cloud-alarm.onrender.com/api/admin/register-device \
  -H "Content-Type: application/json" \
  -d '{
    "householdId": "your-household-id",
    "deviceId": "ESP32_001",
    "deviceSecret": "6195d9a4faa9ef076a21eab5810e4ef8"
  }'
```

## Verification Steps

After registering the device:

1. **Check MongoDB:**
   ```javascript
   db.households.findOne(
     { "devices.deviceId": "ESP32_001" },
     { householdId: 1, "devices.$": 1 }
   )
   ```
   
   Should return:
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

2. **Watch ESP32 Serial Monitor:**
   ```
   Data sent, response: 200  ← Should now be 200, not 401!
   ```

3. **Check Web Dashboard:**
   - Should show "Connected" (green)
   - Sensor readings should update in real-time

## Common Issues

### Issue: "I don't know my household ID"

**Solution:** Check your browser localStorage:
1. Open browser console (F12)
2. Go to Application tab → Local Storage
3. Look for `householdToken`
4. Decode it (it's a JWT token) or check MongoDB for households

### Issue: "Device is already in devices array but still getting 401"

**Solution:** Check if the deviceSecret matches EXACTLY:
```javascript
// In MongoDB
db.households.findOne(
  { "devices.deviceId": "ESP32_001" },
  { "devices.$": 1 }
)

// Compare the deviceSecret with your config.h:
// config.h: 6195d9a4faa9ef076a21eab5810e4ef8
// MongoDB: should match exactly (case-sensitive)
```

### Issue: "Multiple households have the same device"

**Solution:** Remove device from old households:
```javascript
// Remove from all households first
db.households.updateMany(
  {},
  { $pull: { devices: { deviceId: "ESP32_001" } } }
)

// Then add to correct household
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

## Expected Serial Monitor Output After Fix

```
=== FireWire Smart Fire Alarm ===
WiFi connected via WiFiManager!
IP: 192.168.1.100
SSID: Boarding House
Signal: -61 dBm

Raw ADC - MQ2: 132, MQ7: 206, MQ135: 337
CO: 10.3 PPM (normal), AQI: 54 (moderate)
Data sent, response: 200  ← SUCCESS!

[CMD] Checking commands... HTTP 200  ← SUCCESS!
```

## Quick Test

After fixing, test the endpoint manually:

```bash
curl -X POST https://cloud-alarm.onrender.com/api/device/ESP32_001/data \
  -H "Content-Type: application/json" \
  -H "X-Device-Secret: 6195d9a4faa9ef076a21eab5810e4ef8" \
  -d '{
    "gas": 10,
    "temperature": 25,
    "humidity": 50,
    "alarm": false
  }'
```

**Expected:** `{"success":true}`
**If 401:** Device not registered or wrong secret

---

**Next Step:** Check your MongoDB and register the device in your household!
