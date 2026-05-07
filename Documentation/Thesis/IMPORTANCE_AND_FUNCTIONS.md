# Importance and Functions of FireWire: ESP32-Based Smart Fire Alarm System with Cloud Monitoring

## Importance

The importance of FireWire lies in its ability to provide early fire and gas hazard detection for Filipino residential households. According to the Bureau of Fire Protection, residential fires account for over 60% of fire incidents in the Philippines, yet most homes lack proper fire detection systems. FireWire addresses this critical safety gap by offering an affordable, accessible solution that combines local alarm functionality with cloud-based remote monitoring.

Early detection is crucial for fire safety. FireWire's multi-sensor approach detects smoke, gas leaks, carbon monoxide, and temperature changes before they escalate into major hazards. The system's real-time alerts via WiFi connectivity enable immediate emergency response, potentially saving lives and preventing property damage. By providing valuable data on fire hazards and environmental conditions, FireWire supports improved household fire safety awareness and better hazard management practices.

The system's dual operation mode ensures continuous protection—local alarms function even during internet outages, while cloud features enable remote monitoring when connectivity is available. This reliability makes FireWire an essential safety tool for modern Filipino homes, particularly in areas where traditional fire alarm systems are cost-prohibitive or unavailable.

## Functions

### 1. Fire and Gas Detection

FireWire continuously monitors environmental conditions using four specialized sensors:
- **MQ-2 Sensor**: Detects smoke and combustible gases (LPG, propane, methane)
- **MQ-7 Sensor**: Measures carbon monoxide concentration in parts per million (PPM)
- **MQ-135 Sensor**: Evaluates overall air quality by detecting combustion byproducts
- **HDC1080 Sensor**: Monitors temperature and humidity levels

The system reads sensor data every 100 milliseconds, ensuring rapid detection of hazardous conditions.

### 2. Local Alarm Activation

When sensor readings exceed configured thresholds, FireWire immediately activates local alarms:
- Piezoelectric buzzer sounds continuously to alert occupants
- 20x4 LCD display shows alarm status and sensor readings
- Visual and audible warnings persist until the hazard clears or user silences the alarm

This local alarm functionality operates independently of internet connectivity, ensuring fire detection capability during network outages.

### 3. Cloud-Based Remote Monitoring

When connected to WiFi, FireWire transmits sensor data to a cloud backend server every 250 milliseconds. The Node.js server processes this data and stores it in a MongoDB database, enabling:
- Real-time monitoring via web dashboard from any internet-connected device
- Historical data logging for trend analysis
- Multi-user access for family members and household occupants
- Remote threshold configuration and system settings adjustment

### 4. Push Notification Delivery

FireWire sends instant push notifications to registered devices when alarms trigger. Using the Web Push API with VAPID authentication, notifications are delivered even when the browser is closed or the phone screen is off. The service worker running in the background receives encrypted push messages and displays notifications with alarm details and action buttons.

### 5. Email Alert System

The system automatically sends email alerts to the admin's registered Gmail address when fire or gas hazards are detected. Email notifications include:
- Alarm timestamp and duration
- Sensor readings that triggered the alarm
- Direct link to the web dashboard
- Recommended safety actions

### 6. Progressive Web App (PWA) Dashboard

FireWire's web dashboard is a Progressive Web App that can be installed on smartphones, tablets, and computers without requiring app store downloads. The PWA provides:
- Real-time sensor monitoring with color-coded status indicators
- Alarm history with PDF export capability
- Settings panel for threshold adjustments (admin only)
- Multi-language support (English and Filipino)
- Statistics and trend charts for sensor data analysis

### 7. Smart Alarm Mode

To reduce false alarms from cooking activities, FireWire offers an optional Smart Alarm Mode. When enabled:
- Smoke detection alone triggers only a warning (yellow card, intermittent beeps)
- Smoke combined with temperature rise triggers full alarm
- Gas leaks and dangerous CO levels always trigger full alarm regardless of mode

This intelligent correlation reduces nuisance alarms while maintaining safety.

### 8. Battery Backup Operation

FireWire operates on dual 18650 lithium-ion batteries, providing 4-6 hours of runtime during power outages. The battery shield includes:
- Built-in charging circuit (5V USB input)
- Over-discharge and over-charge protection
- Pass-through charging (device operates while charging)
- Battery voltage monitoring displayed on dashboard and LCD

### 9. User-Friendly Interface

The system provides two interfaces for different user needs:
- **Physical Interface**: 20x4 LCD display with 5 push buttons for local monitoring and navigation
- **Web Interface**: Responsive dashboard accessible from any device with simplified language for non-technical users

Both interfaces use plain-language status messages (Safe, Caution, Warning, Danger) instead of technical jargon.

### 10. Multi-User Access Control

FireWire implements role-based access with two user types:
- **Admin**: Full control including threshold adjustments, settings changes, and factory reset
- **Household Members**: View-only access with ability to silence alarms

This access model allows family members to monitor home safety without risking accidental misconfiguration.

---

## Summary

FireWire's importance lies in its ability to provide comprehensive fire and gas hazard detection for Filipino homes at an affordable cost. Its functions encompass local alarm activation, cloud-based monitoring, push notifications, email alerts, and user-friendly interfaces—all working together to ensure early hazard detection and rapid emergency response. By combining reliability (local alarms work offline) with modern connectivity (cloud monitoring and remote alerts), FireWire offers a practical solution to residential fire safety challenges in the Philippines.

