# CHAPTER 5
# OPERATION OF THE STUDY

## Overview

This chapter offers a comprehensive guide for using the FireWire Smart Fire and Gas Monitoring System. The chapter covers WiFi setup, operating modes (online and offline), maintenance procedures, safety precautions, and troubleshooting. FireWire is designed for residential use by non-technical users, providing both local alarm functionality and cloud-based remote monitoring.

---

## Operating Guide

### 1. Initial Setup and WiFi Configuration

**First-Time Setup:**

When powering on FireWire for the first time, the device will create a WiFi hotspot named "FireWire-Setup" for configuration.

1. Power on the device using the battery shield or USB power adapter
2. Wait 30 seconds for the LCD to display "FireWire-Setup" hotspot information
3. Using a smartphone or computer, connect to the "FireWire-Setup" WiFi network
4. A configuration page will open automatically (captive portal)
5. Select your home WiFi network from the list
6. Enter your WiFi password
7. Click "Save" to store the credentials
8. The device will restart and connect to your home network
9. The LCD will display "WiFi Connected" with your network name

**Reconfiguring WiFi (if network changes):**

1. Press and hold Button 5 for 2 seconds
2. The device will attempt to reconnect to the saved network
3. If reconnection fails, the "FireWire-Setup" hotspot will activate
4. Follow steps 3-9 above to configure the new network

**Web Dashboard Setup:**

1. Open a web browser and go to: https://cloud-alarm.onrender.com
2. For first-time setup, click "Create New Household"
3. Sign in with your Google account
4. Enter the 6-digit code sent to your email
5. Fill in the setup form:
   - Household name (e.g., "Santos Family Home")
   - Your name
   - Home password (shared with family members)
   - Admin PIN (4-6 digits, for sensitive settings)
   - Family code (6 digits, shared with family members)
6. Click "Complete Setup"
7. You will receive a confirmation email with your credentials

### 2. Operating Modes

FireWire operates in two modes depending on internet connectivity:

**Online Mode (WiFi Connected):**

When connected to WiFi, FireWire provides full functionality:
- Real-time sensor monitoring on the web dashboard
- Push notifications to smartphones when alarms trigger
- Email alerts to the admin
- Remote threshold adjustments
- Alarm history logging
- Multi-user access (admin and family members)

The ESP32 device sends sensor data to the cloud every 250 milliseconds. The web dashboard updates in real-time via WebSocket connection, typically with 2-5 seconds latency.

**Offline Mode (No WiFi):**

When WiFi is unavailable, FireWire continues essential fire detection:
- Local alarm logic continues (sensors checked every 100ms)
- Buzzer sounds when thresholds are exceeded
- LCD display shows current sensor readings
- Button navigation works normally
- Threshold values remain as last configured

Limitations in offline mode:
- No remote monitoring via web dashboard
- No push notifications or email alerts
- No data logging to cloud database
- Cannot change settings remotely

The device automatically reconnects when WiFi becomes available, resuming full functionality without user intervention.

### 3. LCD Display and Button Controls

The 20x4 LCD display provides local monitoring. Five buttons allow navigation between different display modes:

**Default Display (No button pressed):**
```
==== FireWire ====
Gas:12% Smoke:3%
Temp:28C Hum:65%
CO:8PPM AQI:45
```

**Button 1 - Temperature & Humidity:**
Shows temperature and humidity status in plain language (Cool, Normal, Warm, Hot, Very Hot for temperature; Dry, Low, Normal, Humid for humidity).

**Button 2 - Gas/LPG & Air Quality:**
Displays gas leak status (Safe, Caution, Warning, Danger) and air quality (Clean, Moderate, Poor, Unhealthy).

**Button 3 - Smoke Detection:**
Shows smoke level status with safety messages (Safe, Detected, Warning, Danger).

**Button 4 - Carbon Monoxide:**
Displays CO level status with health guidance (Safe, Caution, Warning, Danger).

**Button 5 - System Information:**
Shows WiFi status, system uptime, and available memory. Press and hold for 2 seconds to reconfigure WiFi.

The display returns to the default overview after 15 seconds of inactivity.

### 4. Web Dashboard Access

**Admin Login:**
1. Go to https://cloud-alarm.onrender.com
2. Click "Admin Login"
3. Enter your home password and Gmail address
4. Enter the 6-digit code sent to your email
5. Enter your admin PIN
6. Optionally check "Remember this device" to skip email code on future logins

**Family Member Login:**
1. Go to https://cloud-alarm.onrender.com
2. Click "Household Member Login"
3. Enter the home password
4. Enter the 6-digit family code
5. Optionally enter your name
6. Click "Join Household"

**Dashboard Features:**

The dashboard displays six sensor cards:
- Gas/LPG Leak (percentage and status)
- Smoke Detected (percentage and status)
- Carbon Monoxide (PPM and health guidance)
- Air Quality (AQI and status)
- Room Temperature (Celsius and comfort level)
- Humidity (percentage and status)

Additional features:
- Alarm status card (shows active alarms)
- Alarm history tab (view past events)
- Settings tab (admin only - adjust thresholds, enable Smart Alarm Mode)
- Statistics tab (sensor trends and charts)

### 5. Alarm Response

**When an alarm triggers:**

1. **Local Response (immediate):**
   - Buzzer sounds continuously
   - LCD displays red alarm screen showing which sensor triggered
   - Alarm persists until condition clears or user silences it

2. **Cloud Response (if online):**
   - Push notification sent to all subscribed devices
   - Email alert sent to admin
   - Alarm recorded in history database
   - Dashboard shows red alarm card

**To silence an alarm:**
- Press any button on the device (local silence), OR
- Click "Silence Alarm" button on the web dashboard

**Smart Alarm Mode:**

When enabled (admin setting), Smart Alarm Mode reduces false alarms from cooking:
- Smoke detection alone triggers only a yellow warning (no siren)
- Smoke + temperature rise triggers full alarm
- Gas and CO always trigger full alarm regardless of mode

### 6. Threshold Adjustment (Admin Only)

Default thresholds can be adjusted via the web dashboard Settings tab:

- **Gas Threshold:** Default 40% (range 10-100%)
- **Smoke Threshold:** Default 4% (range 1-20%)
- **Temperature Threshold:** Default 60°C (range 40-80°C)
- **CO Warning:** Default 35 PPM (range 10-100 PPM)
- **CO Danger:** Default 100 PPM (range 50-200 PPM)
- **CO Critical:** Default 400 PPM (range 200-600 PPM)

Changes are transmitted to the ESP32 device within 500 milliseconds.

### 7. Battery Operation

FireWire uses two 18650 lithium-ion batteries providing 4-6 hours of runtime:

**Battery Monitoring:**
- Battery voltage is displayed on the dashboard and LCD
- Low battery warning appears when voltage drops below 3.2V per cell

**Charging:**
- Connect a USB power adapter (5V, 1A minimum) to the Micro-USB port
- Red LED indicates charging in progress
- Green LED indicates charging complete
- Charge time: 5-6 hours for fully depleted batteries
- The device can operate while charging

---

## Maintenance Procedures

### 1. Sensor Calibration

**Frequency:** Monthly (or every 2 weeks in environments with heavy cooking)

**Procedure:**
1. Place the device in a clean air environment (outdoors or well-ventilated room)
2. Power on and wait 5 minutes for sensor warmup
3. Log in to the web dashboard as admin
4. Navigate to Settings tab
5. Click "Calibrate Sensors" button
6. Wait 30 seconds for calibration to complete
7. Verify that gas, smoke, CO, and AQI readings show near-zero values

The dashboard displays the last calibration date. A warning appears if calibration is overdue (>45 days).

### 2. LCD Display Cleaning

**Frequency:** As needed (when dust or fingerprints accumulate)

**Procedure:**
1. Power off the device
2. Use a soft, lint-free microfiber cloth slightly dampened with water
3. Gently wipe the LCD surface in one direction
4. Do not use alcohol, ammonia, or abrasive cleaners
5. Do not spray liquid directly onto the LCD
6. Allow to air dry completely before powering on

**Contrast Adjustment:**
If text appears too faint or too dark, adjust the blue potentiometer on the back of the LCD module while the display is powered on.

### 3. Battery Maintenance

**Monthly Inspection:**
- Check battery voltage (should read 3.7-4.2V per cell when fully charged)
- Verify charging indicator LED functions correctly
- Inspect battery terminals for corrosion
- Ensure power switch operates smoothly

**Charging Best Practices:**
- Charge before voltage drops below 3.3V per cell
- Avoid leaving batteries fully discharged for extended periods
- Use a quality 5V USB adapter (1A minimum)
- Charge at room temperature (20-25°C)
- Disconnect when green LED indicates full charge

**Battery Replacement:**

Replace batteries when:
- Runtime drops below 2 hours on full charge
- Batteries fail to reach 4.2V after full charge
- Physical damage, swelling, or leakage observed
- Batteries are more than 3 years old

**Replacement Procedure:**
1. Power off and disconnect USB cable
2. Remove battery shield cover
3. Note polarity markings (+ and -)
4. Remove old batteries
5. Insert new batteries with correct polarity
6. Replace cover and secure screws
7. Power on and verify voltage reading

**Recommended Battery Specifications:**
- Type: 18650 lithium-ion rechargeable
- Capacity: 2500mAh minimum (3000-3500mAh preferred)
- Protection: Protected cells with built-in PCB
- Brand: Samsung, Panasonic, LG, or Sony

### 4. Physical Inspection

**Quarterly Inspection:**
- Check all wiring connections for looseness
- Inspect sensors for dust accumulation (gently vacuum around sensors if needed)
- Verify buzzer sounds clearly when tested
- Check LCD backlight brightness
- Ensure buttons respond when pressed
- Inspect enclosure for cracks or damage

---

## Safety Precautions

### 1. Installation Safety

**Proper Placement:**
- Install on ceiling or high on wall (within 12 inches of ceiling)
- Position in central location (hallway or living room)
- Maintain at least 10 feet distance from cooking areas
- Avoid bathrooms, garages, or areas with extreme temperatures

**Locations to Avoid:**
- Near air conditioning vents or fans
- Direct sunlight or heat sources
- Unheated areas (below 0°C or above 50°C)
- Areas with high humidity or steam

**Clearance Requirements:**
- Maintain 6 inches clearance around device for air circulation
- Do not cover sensors with decorations or furniture
- Do not paint over sensor openings

### 2. Electrical Safety

- Use only the provided battery shield or compatible 5V power supply
- Do not exceed 5V on the VIN pin
- Ensure all wiring connections are secure and insulated
- Do not operate with exposed wiring or damaged cables
- Use UL-listed or equivalent safety-certified AC adapters
- Install in dry location; do not expose to water

### 3. Battery Safety

**Important Warnings:**
- Use only genuine 18650 lithium-ion batteries from reputable manufacturers
- Never use damaged, dented, or swollen batteries
- Do not short-circuit battery terminals
- Do not expose batteries to fire or extreme heat (>60°C)
- Do not disassemble or modify batteries
- Store spare batteries away from flammable materials
- Dispose of old batteries at designated recycling centers

**Operating Temperature:** 0°C to 45°C

### 4. Fire Safety Awareness

**Critical Understanding:**

FireWire is a fire **detection** system, not a fire **suppression** system. It alerts occupants to fire hazards but does not extinguish fires.

**Emergency Response:**
- When alarm sounds, immediately investigate the cause
- If fire is detected, evacuate all occupants immediately
- Call emergency services (Bureau of Fire Protection: 8426-0219)
- Do not attempt to fight large fires
- Have a family fire escape plan and practice regularly
- Keep fire extinguishers accessible

**System Limitations:**
- Cannot detect fires in closed rooms if door is shut
- Response time is typically 10-30 seconds
- Battery provides 4-6 hours backup during power outages
- Requires periodic maintenance and calibration

### 5. Child Safety

- Install device out of reach of young children
- Educate children about alarm sound and evacuation procedures
- Do not allow children to play with the device
- Ensure children understand this is a safety tool, not a toy

### 6. Use of Manufacturer-Recommended Parts

- Replace sensors only with specified models (MQ-2, MQ-7, MQ-135, HDC1080)
- Use compatible 18650 batteries meeting specifications
- Do not substitute components with different ratings
- Unauthorized modifications void warranty and may create hazards

---

## Troubleshooting

### Common Problems and Solutions

| Problem | Possible Cause | Solution |
|---------|---------------|----------|
| **LCD shows blank screen** | Contrast too low | Adjust blue potentiometer clockwise |
| | Loose wiring | Check SDA/SCL connections to GPIO 21/22 |
| | Insufficient power | Verify 5V power supply provides 1A minimum |
| **Sensors show constant 0 or 4095** | Sensor not connected | Verify VCC, GND, and analog output connections |
| | Insufficient warmup | Allow 2-3 minutes for MQ sensors to heat up |
| | Sensor failure | Replace faulty sensor module |
| **WiFi connection fails** | Incorrect credentials | Verify SSID and password, reconfigure via Button 5 |
| | 5GHz network selected | ESP32 only supports 2.4GHz; select 2.4GHz network |
| | Weak signal | Move device closer to router or use WiFi extender |
| **Device shows "Offline" on dashboard** | WiFi disconnected | Check router status and ESP32 WiFi connection |
| | ESP32 crashed | Power cycle device (turn off, wait 10 seconds, turn on) |
| **Push notifications not working** | Permission not granted | Check browser notification permissions in settings |
| | Service worker not registered | Clear browser cache and reload page |
| | iOS Safari limitations | Use Android or desktop browser for reliable notifications |
| **Battery drains quickly (<2 hours)** | Old or degraded batteries | Replace with new high-capacity cells (2500mAh+) |
| | Buzzer sounding frequently | Investigate and resolve alarm condition |
| **False alarms from cooking** | High sensitivity mode | Enable Smart Alarm Mode in dashboard settings |
| | Sensor too close to kitchen | Relocate device farther from cooking area (10+ feet) |
| | Sensor needs calibration | Perform sensor calibration in clean air |
| **Temperature reading incorrect** | HDC1080 not connected | Verify I2C connections (SDA to GPIO 21, SCL to GPIO 22) |
| | Sensor near heat source | Move away from direct sunlight, heaters, or AC vents |
| **Dashboard not loading** | Server sleeping (free tier) | Wait 30-60 seconds for server to wake up |
| | Browser cache issue | Clear browser cache and reload page |
| **Cannot log in as admin** | Incorrect PIN | Verify PIN is correct (case-sensitive if alphanumeric) |
| | OTP expired | Request new OTP (codes expire after 10 minutes) |
| | Email not received | Check spam folder; verify Gmail address |

### Advanced Diagnostics

**Serial Monitor Debugging:**

For persistent issues, connect the ESP32 to a computer via USB and monitor serial output:

1. Connect ESP32 to computer via USB cable
2. Open Arduino IDE
3. Select Tools → Serial Monitor
4. Set baud rate to 115200
5. Observe debug output showing WiFi status, sensor readings, and error messages

**I2C Device Scanner:**

If LCD or HDC1080 not responding, run an I2C scanner to detect connected devices. Expected devices: 0x27 (or 0x3F) for LCD, 0x40 for HDC1080.

### When to Contact Technical Support

Contact support if:
- Device does not power on after verifying power supply
- Smoke or burning smell from device (disconnect power immediately)
- Sensor readings remain erratic after calibration and replacement
- ESP32 repeatedly crashes or reboots
- Issue not covered in this troubleshooting guide

---

## Summary

This chapter has provided comprehensive guidance for operating and maintaining the FireWire Smart Fire and Gas Monitoring System. Key points include:

- **Dual Operation Modes:** FireWire functions both online (with full cloud features) and offline (local alarm only), ensuring continuous fire detection regardless of internet connectivity.

- **User-Friendly Interface:** The LCD display with button navigation and web dashboard provide accessible monitoring for non-technical users.

- **Regular Maintenance:** Monthly sensor calibration, battery care, and periodic inspection ensure reliable long-term operation.

- **Safety First:** Proper installation, battery handling, and understanding system limitations are critical for effective fire protection.

- **Troubleshooting Resources:** The troubleshooting table addresses common issues, enabling users to resolve problems quickly.

FireWire provides affordable, accessible fire and gas monitoring for Filipino residential households, combining local alarm reliability with modern cloud-based remote monitoring capabilities.

