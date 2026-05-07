# CHAPTER 5
# OPERATION OF THE STUDY

## Overview

This chapter provides guidance for operating and maintaining the FireWire Smart Fire and Gas Monitoring System. FireWire is designed for Filipino residential households, offering both local alarm functionality and cloud-based remote monitoring for comprehensive fire and gas hazard detection.

---

## Operating Guide

### 1. Initial Setup and WiFi Configuration

When powering on FireWire for the first time, the device creates a WiFi hotspot named "FireWire-Setup" for configuration.

1. Power on the device
2. Wait 30 seconds for "FireWire-Setup" hotspot
3. Connect smartphone to "FireWire-Setup" network
4. Configuration page opens automatically
5. Select home WiFi network and enter password
6. Device restarts and connects to home network

**Reconfiguring WiFi:** Press and hold Button 5 for 2 seconds to activate hotspot mode.

### 2. Operating Modes

**Online Mode (WiFi Connected):**
- Real-time sensor monitoring on web dashboard
- Push notifications to smartphones
- Email alerts to admin
- Remote threshold adjustments
- Alarm history logging

**Offline Mode (No WiFi):**
- Local alarm logic continues
- Buzzer sounds when thresholds exceeded
- LCD display shows sensor readings
- Button navigation works normally

### 3. LCD Display and Button Controls

**Default Display:**
```
==== FireWire ====
Gas:12% Smoke:3%
Temp:28C Hum:65%
CO:8PPM AQI:45
```

**Button Functions:**
- Button 1: Temperature & Humidity status
- Button 2: Gas/LPG & Air Quality status
- Button 3: Smoke detection status
- Button 4: Carbon Monoxide status
- Button 5: System information (hold 2s for WiFi setup)

Display returns to default after 15 seconds of inactivity.

### 4. Web Dashboard Access

**Admin Login:**
1. Go to https://cloud-alarm.onrender.com
2. Enter home password and Gmail address
3. Enter 6-digit code from email
4. Enter admin PIN

**Family Member Login:**
1. Go to https://cloud-alarm.onrender.com
2. Enter home password
3. Enter 6-digit family code

### 5. Alarm Response

**When alarm triggers:**
- Buzzer sounds continuously
- LCD displays alarm screen
- Push notification sent (if online)
- Email alert sent to admin (if online)

**To silence:** Press any button or click "Silence Alarm" on dashboard.

### 6. Battery Operation

- Runtime: 4-6 hours on full charge
- Charging: 5-6 hours via USB (Micro-USB port)
- Red LED = charging, Green LED = fully charged

---

## Maintenance Procedures

### 1. Rapidly Check and Inspect

- Check for obstructions on all sensor openings
- Verify screen displays current sensor readings
- Verify all buttons respond when pressed
- Inspect device by checking wire connections
- Repeat calibration if readings appear incorrect
- Contact technical support if problems persist

### 2. Clean the Device

- Clean sensors with soft, dry cloth monthly
- Inspect components and remove dust buildup
- Update firmware as needed for optimal performance

### 3. Contact Technical Support

- Refer to troubleshooting section for error codes
- Perform system reboot to clear temporary issues

---

## Safety Precautions

### 1. General Precautions

- Ensure device is properly powered via battery or USB
- Do not expose to water or excessive moisture
- FireWire detects fire and gas hazards in residential homes
- Early detection helps prevent property damage and saves lives
- Real-time alerts via WiFi enable immediate emergency response
- System provides data to improve household fire safety awareness
- Overall, FireWire supports safer homes and better hazard management

### 2. Operational Safety

- Do not insert objects into sensor openings
- Do not tamper with internal components
- Disconnect power before maintenance or repairs
- Supervise children near the device

### 3. Maintenance Safety

- Use only manufacturer-recommended replacement parts
- Wear protective gloves when handling batteries
- Ensure device is securely mounted after maintenance

---

## Troubleshooting Tips

### 1. Device Not Detecting Hazards

- Check if device is powered on
- Verify sensors have warmed up (3 minutes)
- Ensure sensors are clean and unobstructed
- Restart device if unresponsive

### 2. WiFi Connection Problems

- Use only 2.4GHz WiFi (NOT 5GHz)
- ESP32 does not support 5GHz networks
- Check WiFi password is correct
- Move device closer to router if signal is weak
- Restart router if other devices cannot connect

---

## Summary

This chapter has provided comprehensive guidance for operating and maintaining the FireWire system. Key points include:

- **Dual Operation Modes:** FireWire functions both online (with full cloud features) and offline (local alarm only), ensuring continuous fire detection.

- **User-Friendly Interface:** LCD display with button navigation and web dashboard provide accessible monitoring for non-technical users.

- **Regular Maintenance:** Monthly sensor calibration and cleaning ensure reliable operation.

- **Safety First:** Proper installation and understanding system limitations are critical for effective fire protection.

- **Troubleshooting Resources:** Quick reference for resolving common issues.

FireWire provides affordable, accessible fire and gas monitoring for Filipino residential households, combining local alarm reliability with modern cloud-based remote monitoring capabilities.

