# CHAPTER 5: IMPLEMENTATION AND OPERATION

## 5.1 Overview of the Study

FireWire is a cloud-based Internet of Things (IoT) fire and gas monitoring system designed specifically for Filipino residential households. The system addresses a critical safety gap in Philippine fire protection infrastructure. According to the Bureau of Fire Protection, residential fires account for over 60% of fire incidents in the Philippines, yet most single-family homes lack any fire detection system due to cost barriers and limited accessibility to advanced monitoring technologies. FireWire provides an affordable, accessible solution by combining local sensor monitoring with cloud-based remote alerts, enabling homeowners to monitor their property from anywhere via a smartphone or computer.

The system consists of three integrated components working in concert: (1) an ESP32-based hardware device equipped with multiple gas and environmental sensors, (2) a Node.js cloud backend hosted on Render.com that processes data and manages user accounts, and (3) a Progressive Web App (PWA) dashboard that provides real-time monitoring and push notifications. Unlike traditional standalone fire alarms that operate in isolation, FireWire operates in both online and offline modes—the local alarm functions independently even without internet connectivity, while cloud features enable remote monitoring, multi-user access, and comprehensive data logging when WiFi is available.

This chapter details the complete operation of the FireWire system, including sensor data acquisition, alarm trigger logic, user interface interaction, maintenance procedures, safety precautions, and troubleshooting guidelines. Both technical implementation details and practical user instructions are provided to serve as a comprehensive reference for system operation and maintenance. The chapter is structured to address both the technical aspects relevant to engineering professionals and the operational procedures necessary for end-users to safely and effectively utilize the system.

---

## 5.2 System Operation

### 5.2.1 Online Mode Operation

Online mode represents the full-featured operational state of FireWire when the ESP32 device maintains an active WiFi connection to the internet. In this mode, all system capabilities are available, including real-time remote monitoring, push notifications, email alerts, and cloud data logging.

#### 5.2.1.1 Sensor Data Acquisition and Transmission

The ESP32 microcontroller continuously monitors environmental conditions through four primary sensors operating on independent sampling cycles. The MQ-2 sensor detects combustible gases (LPG, propane, methane) and smoke particles, the MQ-7 sensor measures carbon monoxide concentration in parts per million (PPM), the MQ-135 sensor evaluates overall air quality by detecting ammonia, nitrogen oxides, and other combustion byproducts, and the HDC1080 sensor monitors temperature and humidity levels. Each sensor is read every 100 milliseconds to ensure rapid detection of hazardous conditions.

The data acquisition process follows a structured sequence. First, the ESP32 reads analog voltage values from each MQ-series sensor through its 12-bit analog-to-digital converter (ADC), producing values ranging from 0 to 4095. These raw ADC readings are then converted to meaningful units: gas and smoke levels are expressed as percentages relative to calibrated baseline values, carbon monoxide is calculated in PPM using the sensor's characteristic resistance curve, and air quality is expressed as an Air Quality Index (AQI) value. Temperature and humidity readings are obtained digitally via the I2C communication protocol from the HDC1080 sensor, providing measurements in degrees Celsius and relative humidity percentage respectively.

Once sensor values are processed, the ESP32 evaluates local alarm conditions by comparing readings against configured thresholds. If any sensor exceeds its threshold value, the local alarm activates immediately—the piezoelectric buzzer sounds and the LCD display shows an alarm warning. This local alarm logic operates independently of cloud connectivity, ensuring fire detection capability even during internet outages.

Every 250 milliseconds, the ESP32 transmits a complete sensor data packet to the cloud backend via HTTP POST request. The data packet includes all current sensor readings, alarm status, system uptime, available memory, and battery voltage. This transmission uses HTTPS encryption to protect data in transit and includes a device secret key in the request header for authentication. The relatively high transmission frequency (four times per second) ensures that the cloud dashboard reflects near-real-time conditions with minimal latency.

#### 5.2.1.2 Cloud Backend Processing

The Node.js backend server, hosted on Render.com, receives sensor data transmissions and performs several critical functions. Upon receiving a data packet, the server first authenticates the request by verifying the device secret key against the value stored in the MongoDB database. If authentication fails, the request is rejected with a 401 Unauthorized response.

For authenticated requests, the server extracts the sensor readings and performs additional calculations. Carbon monoxide status is determined by comparing PPM values against health-based thresholds: readings below 35 PPM are classified as "normal," 35-99 PPM as "warning," 100-399 PPM as "danger," and 400 PPM or above as "critical." Air quality status is similarly categorized: AQI values 0-50 are "good," 51-100 are "moderate," 101-150 are "unhealthy for sensitive groups," and above 150 are "unhealthy."

The server also implements fire risk detection logic that analyzes correlations between multiple sensors. If carbon monoxide levels are elevated while temperature is simultaneously rising and gas levels are increasing, the system flags a high fire risk condition even if individual sensors have not yet exceeded their alarm thresholds. This multi-sensor correlation approach reduces false negatives and provides earlier warning of developing fire conditions.

All processed data is saved to the MongoDB Atlas database in two collections. The Device collection stores the current state of each sensor and the most recent readings, while the GasHistory collection maintains a time-series record of gas, smoke, CO, and AQI values for trend analysis and historical reporting. Database writes are performed asynchronously to minimize response latency.

#### 5.2.1.3 Real-Time Communication via WebSocket

While HTTP POST requests handle data transmission from the ESP32 to the server, real-time updates to web dashboard clients are delivered via WebSocket connections. WebSocket is a communication protocol that establishes a persistent, bidirectional connection between the browser and server, allowing the server to push data to clients instantly without requiring the client to repeatedly poll for updates.

When a user logs into the FireWire dashboard, the browser establishes a WebSocket connection to the server endpoint `wss://cloud-alarm.onrender.com/ws/ESP32_001` (where ESP32_001 is the device identifier). The connection URL includes the user's session token as a query parameter for authentication. The server validates this token against the MongoDB database and, if valid, marks the WebSocket connection as authenticated.

Once authenticated, the WebSocket connection remains open indefinitely. To prevent idle timeout disconnections imposed by cloud hosting platforms, both the client and server implement keepalive mechanisms. The browser sends a ping message every 25 seconds, to which the server responds with a pong message. Additionally, the server sends WebSocket-level ping frames every 30 seconds. If a client fails to respond to three consecutive pings, the server terminates that connection as inactive.

When the server receives new sensor data from the ESP32, it immediately broadcasts this data to all authenticated WebSocket clients associated with that device. The broadcast message is a JSON object containing the complete sensor state, alarm status, and timestamp. Upon receiving this message, the browser's JavaScript code updates all dashboard elements—sensor bars, numerical displays, status badges, and alarm cards—without requiring a page refresh. This creates a seamless real-time monitoring experience with typical latency of 2-5 seconds from sensor detection to dashboard display.

If a WebSocket connection is interrupted due to network issues or server restart, the browser automatically attempts to reconnect using an exponential backoff strategy. The first reconnection attempt occurs after 1 second, the second after 2 seconds, the third after 4 seconds, and so on, up to a maximum interval of 30 seconds between attempts. The browser will attempt up to 10 reconnections before displaying a persistent connection error message to the user.



#### 5.2.1.4 Alarm Trigger Logic and Notification System

FireWire implements two distinct alarm modes to accommodate different household environments and user preferences: High Sensitivity Mode and Smart Alarm Mode.

**High Sensitivity Mode (Default Configuration)**

In High Sensitivity Mode, any single sensor exceeding its configured threshold immediately triggers a full alarm condition. The default thresholds are: gas level ≥ 40%, smoke level ≥ 4%, temperature ≥ 60°C, or carbon monoxide ≥ 100 PPM. When any of these conditions is met, the following alarm sequence activates:

1. **Local Alarm Activation**: The ESP32 immediately sounds the piezoelectric buzzer with a continuous tone and displays a red alarm warning on the LCD screen. This local response occurs within 100 milliseconds of threshold exceedance, independent of cloud connectivity.

2. **Cloud Alarm Registration**: The ESP32 transmits the alarm state to the cloud backend in its next data packet (within 250 milliseconds). The server detects the transition from non-alarm to alarm state and creates a new record in the AlarmHistory collection, timestamping the event and recording which sensor(s) triggered the alarm.

3. **Push Notification Delivery**: The server retrieves all active push notification subscriptions for the household from the database and sends encrypted push messages to each subscribed device using the Web Push API with VAPID (Voluntary Application Server Identification) authentication. The push notification includes the alarm type, sensor readings, and action buttons ("Open Dashboard" and "Dismiss"). These notifications are delivered even if the browser is closed or the phone screen is off, as they are handled by the service worker running in the background.

4. **Email Alert Transmission**: Simultaneously, the server sends an email alert to the admin's registered Gmail address using the Nodemailer library and Gmail SMTP service. The email contains a summary of the alarm condition, current sensor readings, timestamp, and a direct link to the dashboard.

5. **Dashboard Visual Alert**: All connected web dashboard clients receive the alarm state via WebSocket broadcast and immediately display a prominent red alarm card with pulsing animation, sensor readings, and a "Silence Alarm" button. If audio alerts are enabled, the browser plays the selected alarm sound (911.mp3, Alarm2.mp3, or Alarm3.mp3) in a continuous loop.

**Smart Alarm Mode (Optional Configuration)**

Smart Alarm Mode is designed to reduce false alarms caused by cooking activities, which commonly produce smoke without representing a genuine fire hazard. When Smart Alarm Mode is enabled, the alarm logic incorporates temperature correlation:

- **Smoke Detection Alone**: If smoke levels exceed the threshold but temperature remains normal (below 60°C) and is not rising rapidly, the system enters a "partial warning" state rather than full alarm. The dashboard displays a yellow warning card, the LCD shows a caution message, and the buzzer emits intermittent beeps (3 short beeps every 2 seconds) rather than a continuous tone. No push notifications or emails are sent during partial warning.

- **Smoke with Temperature Rise**: If smoke is detected AND temperature exceeds 60°C OR temperature is rising at a rate greater than 2°C per minute, the system immediately escalates to full alarm with all notification channels activated. This correlation logic effectively distinguishes between cooking smoke (which does not significantly raise ambient temperature) and combustion smoke from an actual fire.

- **Gas and CO Detection**: Regardless of Smart Alarm Mode setting, gas leaks (≥40%) and dangerous carbon monoxide levels (≥100 PPM) always trigger full alarm immediately, as these conditions represent immediate health hazards independent of fire presence.

The alarm mode can be toggled by the admin user through the dashboard settings panel. The mode selection is saved to the MongoDB database and transmitted to the ESP32 during its next command polling cycle, ensuring both cloud and local alarm logic remain synchronized.

#### 5.2.1.5 Multi-User Access Control

FireWire implements a role-based access control system with two distinct user types: Admin and Household Members.

**Admin Access**

The admin user, typically the homeowner or primary system operator, has full control over all system functions. Admin authentication requires three factors:

1. **Google OAuth Verification**: The admin must sign in with the Google account registered during initial setup. This provides email verification and leverages Google's security infrastructure.

2. **Email OTP (One-Time Password)**: After Google sign-in, a 6-digit numeric code is sent to the admin's Gmail address. This code must be entered within 10 minutes and can only be used once. The OTP requirement can be bypassed on trusted devices (see below).

3. **Admin PIN**: A 4-6 digit PIN chosen during setup must be entered. The PIN is stored in the database as a SHA-256 hash, never in plain text, preventing exposure even if the database is compromised.

Once authenticated, the admin receives a session token—a cryptographically random 64-character hexadecimal string—which is stored in the browser's localStorage and included in all subsequent API requests. Admin sessions expire after 7 days of inactivity.

Admin users can optionally enable "Remember this device" during login, which creates a trusted device token valid for 30 days. On trusted devices, the OTP step is skipped, requiring only Google sign-in and PIN entry. This reduces friction for frequent access while maintaining security through the PIN requirement.

Admin capabilities include:
- Viewing all sensor data and alarm history
- Modifying threshold values for all sensors
- Toggling Smart Alarm Mode
- Changing alarm sound selection
- Enabling/disabling email alerts
- Silencing active alarms
- Clearing alarm history
- Performing factory reset
- Managing household member access
- Viewing system statistics and trends

**Household Member Access**

Household members (family members, roommates, domestic staff) have view-only access with limited control functions. Member authentication requires:

1. **Home Password**: A shared password (6-20 characters) set during initial setup and known to all household members.

2. **Family Code**: A 6-digit numeric code that serves as a second authentication factor. This code is shared among trusted household members but not publicly disclosed.

3. **Member Name (Optional)**: Members can provide their name for identification in access logs, though this is not required for authentication.

Member sessions are validated by the same token mechanism as admin sessions but expire after 30 days instead of 7 days, reflecting the lower privilege level.

Household member capabilities include:
- Viewing current sensor readings
- Viewing alarm status
- Silencing active alarms
- Viewing alarm history (read-only)
- Receiving push notifications (if subscribed)

Members cannot modify thresholds, change system settings, clear history, or perform administrative functions. This access model allows family members to monitor home safety and respond to alarms without risking accidental misconfiguration.



### 5.2.2 Offline Mode Operation

Offline mode ensures that FireWire continues to provide essential fire detection and alarm functions even when internet connectivity is unavailable. This capability is critical for residential fire safety, as network outages, WiFi router failures, or power disruptions to networking equipment should not compromise the system's ability to detect and alert occupants to fire hazards.

#### 5.2.2.1 Local Alarm Logic

When the ESP32 loses WiFi connectivity, it continues executing its core sensor monitoring and alarm logic entirely on the local microcontroller. The sensor reading cycle (every 100 milliseconds) and threshold evaluation logic remain unchanged. If any sensor exceeds its configured threshold, the ESP32 activates the piezoelectric buzzer and displays an alarm warning on the LCD screen.

The threshold values used in offline mode are the most recently received values from the cloud backend, which are stored in the ESP32's non-volatile EEPROM (Electrically Erasable Programmable Read-Only Memory). These values persist across power cycles, ensuring that threshold changes made through the dashboard remain effective even if the device is powered off and later restarted without internet access.

The Smart Alarm Mode setting is similarly stored in EEPROM. If Smart Alarm Mode was enabled when the device last had connectivity, it remains enabled in offline mode, applying the same smoke-temperature correlation logic to reduce false alarms from cooking activities.

#### 5.2.2.2 LCD Display Navigation

In offline mode, the 20x4 character LCD display serves as the primary user interface for monitoring sensor status. The display operates in six distinct modes, selectable via five momentary push buttons:

**Default Display Mode (No Button Pressed)**

The default screen provides an overview of all sensor readings in a compact format:
```
==== FireWire ====
Gas:12% Smoke:3%
Temp:28C Hum:65%
CO:8PPM AQI:45
```

This overview allows users to quickly assess overall system status at a glance. The display updates every second with current sensor values.

**Button 1: Temperature and Humidity Detail**

Pressing Button 1 (connected to GPIO 15) switches the display to a detailed temperature and humidity view with plain-language status indicators:
```
====  FireWire  ====
Temperature: Normal
Humidity: Normal
Everything OK
```

The temperature status is determined by comparing the current reading to Philippine climate norms:
- **Cool**: Below 26°C
- **Normal**: 26-33°C (typical Philippine ambient temperature range)
- **Warm**: 34-36°C
- **Hot**: 37-40°C
- **Very Hot**: Above 40°C

Humidity status is similarly based on Philippine typical humidity ranges (81-88%):
- **Dry**: Below 30%
- **Low**: 30-80%
- **Normal**: 81-88%
- **Humid**: Above 88%

If conditions are outside normal ranges, the third line displays an appropriate message such as "Check conditions" instead of "Everything OK."

**Button 2: Gas/LPG and Air Quality Detail**

Button 2 (GPIO 19) displays gas and air quality status in non-technical language:
```
====  FireWire  ====
Gas/LPG: Safe
Air Quality: Clean
Air is good
```

Gas status categories:
- **Safe**: Below 50% of threshold (typically <20%)
- **Caution**: 50-80% of threshold
- **Warning**: 80-100% of threshold
- **DANGER**: At or above threshold

Air quality status based on AQI:
- **Clean**: AQI 0-50
- **Moderate**: AQI 51-100
- **Poor**: AQI 101-150
- **Unhealthy**: AQI above 150

**Button 3: Smoke Detection Detail**

Button 3 (GPIO 13) shows smoke sensor status:
```
====  FireWire  ====
Smoke: Safe
No smoke detected
Everything OK
```

Smoke status categories:
- **Safe**: Below 50% of threshold
- **Detected**: 50-80% of threshold
- **Warning**: 80-100% of threshold
- **DANGER**: At or above threshold

When smoke is detected at elevated levels, the display provides action-oriented guidance such as "Check for fire!" or "Evacuate now!"

**Button 4: Carbon Monoxide Detail**

Button 4 (GPIO 14) displays carbon monoxide information with safety guidance:
```
====  FireWire  ====
Carbon Monoxide:Safe
Air is clean
Everything OK
```

CO status is based on health-impact thresholds:
- **Safe**: Below 35 PPM (normal ambient levels)
- **Caution**: 35-99 PPM (open windows for ventilation)
- **Warning**: 100-399 PPM (leave the area)
- **DANGER**: 400+ PPM (evacuate immediately)

The third line provides appropriate safety instructions based on the CO level, such as "Open windows," "Leave the area," or "EVACUATE NOW!"

**Button 5: System Information**

Button 5 (GPIO 27) displays system status and WiFi information:
```
====  FireWire  ====
WiFi: Disconnected
Uptime: 02:15:30
Memory: 180KB free
```

This screen shows:
- WiFi connection status (Connected/Disconnected) and SSID if connected
- System uptime in hours:minutes:seconds format
- Available heap memory in kilobytes
- ESP32 chip temperature (if available)

**Display Timeout and Auto-Return**

After any button press, the LCD remains on the selected display mode for 15 seconds. If no additional button presses occur within this period, the display automatically returns to the default overview screen. This ensures that the most informative overview is displayed most of the time while still allowing users to access detailed information on demand.

During an active alarm condition, the LCD overrides all button presses and displays a dedicated alarm screen showing which sensor(s) triggered the alarm and the current readings. This alarm screen remains active until the alarm condition clears or the user silences the alarm (which requires either pressing a specific button combination on the device or using the dashboard if connectivity is restored).

#### 5.2.2.3 WiFi Reconnection Procedure

When operating in offline mode, the ESP32 periodically attempts to reconnect to the saved WiFi network. Every 60 seconds, the device checks if the previously configured WiFi network is available and attempts to connect. If the connection succeeds, the device immediately resumes online operation, transmitting accumulated sensor data and synchronizing its configuration with the cloud backend.

Users can also manually initiate WiFi reconfiguration by pressing and holding Button 5 for 2 seconds. This action triggers the following sequence:

1. **Reconnection Attempt**: The ESP32 first attempts to connect to the saved WiFi credentials with a 10-second timeout. The LCD displays:
```
====  FireWire  ====
Reconnecting WiFi...
Timeout in 10s...
Hold BTN5 to skip
```

2. **Hotspot Activation (If Reconnection Fails)**: If the saved network is not available or the connection fails, the ESP32 activates WiFi Manager mode. It creates a temporary WiFi access point (hotspot) named "FireWire-Setup" with no password. The LCD displays:
```
====  FireWire  ====
Can't reconnect
Opening hotspot...
Connect to:
FireWire-Setup
```

3. **Captive Portal Configuration**: When a user connects their smartphone or computer to the "FireWire-Setup" network, a captive portal automatically opens (the same login page that appears when connecting to public WiFi). This portal displays a list of available WiFi networks. The user selects their home network, enters the password, and submits the form.

4. **Credential Storage and Connection**: The ESP32 receives the new credentials, stores them in flash memory (persistent across power cycles), and attempts to connect to the specified network. If successful, the hotspot is disabled, and the device resumes normal online operation. The LCD displays:
```
====  FireWire  ====
WiFi Connected!
SSID: HomeNetwork
IP: 192.168.1.100
```

5. **Timeout and Offline Continuation**: If no user connects to the hotspot within 5 minutes, the ESP32 automatically disables the hotspot and returns to offline mode to conserve power and maintain local alarm functionality.

This WiFi reconfiguration mechanism allows users to update network credentials without requiring physical access to the device's internal components or reprogramming via USB cable—a significant usability advantage for ceiling-mounted installations.

#### 5.2.2.4 Limitations in Offline Mode

While offline mode maintains core fire detection functionality, several features are unavailable without internet connectivity:

- **No Remote Monitoring**: The web dashboard cannot display current sensor readings, as no data is transmitted to the cloud.
- **No Push Notifications**: Alarm events cannot trigger push notifications to smartphones or browsers.
- **No Email Alerts**: The system cannot send email notifications to the admin.
- **No Data Logging**: Sensor readings and alarm events are not recorded in the MongoDB database. Historical data is not available for the offline period.
- **No Remote Configuration**: Threshold values, Smart Alarm Mode, and other settings cannot be changed remotely through the dashboard.
- **No Multi-User Monitoring**: Household members cannot view system status from their devices.

Despite these limitations, the local alarm—buzzer and LCD display—continues to function normally, ensuring that occupants present in the home are alerted to fire hazards. The offline mode design philosophy prioritizes reliability of core safety functions over advanced features, recognizing that fire detection must remain operational under all circumstances.



### 5.2.3 Hybrid Operation and Seamless Transition

FireWire is designed to transition seamlessly between online and offline modes without user intervention or system restart. This hybrid operational capability ensures continuous fire monitoring regardless of network conditions.

#### 5.2.3.1 Online-to-Offline Transition

When the ESP32 loses WiFi connectivity (due to router failure, internet service interruption, or signal loss), the transition to offline mode occurs automatically:

1. **Connection Loss Detection**: The ESP32 detects connection loss when HTTP POST requests to the cloud backend fail or when the WiFi stack reports disconnection. The device immediately ceases cloud transmission attempts to conserve processing resources and power.

2. **Local Operation Continuation**: All sensor reading, threshold evaluation, and alarm logic continue without interruption. The 100-millisecond sensor sampling cycle is unaffected by network status.

3. **LCD Status Update**: The LCD display updates to show "WiFi: Disconnected" in the system information screen, informing users of the offline state.

4. **Automatic Reconnection Attempts**: The ESP32 begins periodic reconnection attempts every 60 seconds, checking if the saved WiFi network has become available again.

The transition is instantaneous and does not require any user action. Occupants may not even notice the transition unless they are actively viewing the web dashboard, which will display a "Device Offline" status after 30 seconds without receiving data.

#### 5.2.3.2 Offline-to-Online Transition

When WiFi connectivity is restored, the ESP32 automatically resumes online operation:

1. **Connection Establishment**: Upon successful WiFi connection, the ESP32 immediately sends a data packet to the cloud backend to announce its online status.

2. **Configuration Synchronization**: The device polls the `/api/device/ESP32_001/commands` endpoint to retrieve the latest configuration from the cloud. If the admin changed any threshold values or settings while the device was offline, these new values are downloaded and applied immediately.

3. **Data Transmission Resumption**: The ESP32 resumes its normal 250-millisecond data transmission cycle, sending current sensor readings to the cloud.

4. **Dashboard Reconnection**: Web dashboard clients detect the resumed data flow via WebSocket and update the device status from "Offline" to "Online." All sensor displays refresh with current readings.

5. **No Historical Data Backfill**: Sensor readings that occurred during the offline period are not retroactively transmitted to the cloud. The MongoDB database will show a gap in the time-series data corresponding to the offline duration. This design choice prioritizes real-time performance over historical completeness and avoids overwhelming the server with large data uploads after extended outages.

The offline-to-online transition typically completes within 2-3 seconds of WiFi connection establishment, restoring full system functionality with minimal delay.

#### 5.2.3.3 Battery Operation and Charging

FireWire is powered by a dual 18650 lithium-ion battery shield, providing portable operation and backup power during electrical outages. The battery system operates as follows:

**Battery Configuration**

The system uses two 18650 lithium-ion cells (3.7V nominal, 2500mAh typical capacity) connected in parallel through a battery management shield. The shield provides:
- 5V regulated output at up to 3A current (powers ESP32, sensors, LCD, buzzer)
- 3.3V regulated output at up to 1A current (optional, ESP32 has its own 3.3V regulator)
- Built-in charging circuit accepting 5V input via Micro-USB port
- Over-discharge protection (cuts power at ~3.0V per cell to prevent damage)
- Over-charge protection (stops charging at 4.2V per cell)
- Short-circuit protection

**Power Consumption and Runtime**

The complete FireWire system draws approximately 800mA at 5V (4W total power) during normal operation:
- ESP32 with WiFi active: 80-240mA (varies with transmission activity)
- MQ-2 sensor heater: ~150mA
- MQ-7 sensor heater: ~150mA
- MQ-135 sensor heater: ~150mA
- HDC1080 sensor: ~1mA
- LCD with backlight: 20-40mA
- Buzzer (when active): ~30mA

With two 2500mAh batteries (5000mAh total capacity at 3.7V = 18.5Wh energy), the estimated runtime is:
```
Runtime = 18.5Wh ÷ 4W = 4.6 hours
```

Actual runtime may vary from 4-6 hours depending on alarm frequency (buzzer usage), LCD backlight brightness, and WiFi signal strength (weaker signals require more transmission power).

**Charging Operation**

The battery shield can be charged via any standard USB power adapter (5V, 1A minimum) connected to the Micro-USB port. Charging characteristics:
- Charge current: 1A (built into shield)
- Charge time: 5-6 hours for fully depleted 2500mAh batteries
- Charging indicator: Red LED illuminated during charging, green LED when complete
- Pass-through charging: The system can operate normally while charging, drawing power from the USB input while simultaneously charging the batteries

**Battery Monitoring**

The ESP32 monitors battery voltage through a voltage divider circuit connected to an analog input pin. The measured voltage is displayed on the dashboard and LCD, allowing users to assess remaining battery capacity. When battery voltage drops below 3.2V per cell (6.4V total), the system displays a low battery warning on the LCD and dashboard, indicating that charging is needed soon. At 3.0V per cell, the battery shield's protection circuit automatically cuts power to prevent over-discharge damage to the lithium-ion cells.

**Safety Considerations**

Lithium-ion batteries require proper handling to ensure safety:
- Only genuine, high-quality 18650 cells from reputable manufacturers (Samsung, Panasonic, LG) should be used
- Counterfeit or damaged batteries must never be installed, as they may lack proper protection circuits and pose fire/explosion risks
- Batteries should not be exposed to extreme temperatures (operating range: 0°C to 45°C)
- If the device will not be used for extended periods (>3 months), batteries should be removed and stored at approximately 50% charge in a cool, dry location
- The charging port should not be exposed to moisture or conductive materials

---

## 5.3 User Interface and Interaction

FireWire provides two distinct user interfaces: a physical interface consisting of the LCD display and push buttons on the device itself, and a web-based Progressive Web App (PWA) dashboard accessible from any internet-connected device.

### 5.3.1 Physical Interface (LCD Display and Push Buttons)

The physical interface serves as the primary interaction method when users are in proximity to the device and provides essential functionality during offline operation.

#### 5.3.1.1 LCD Display Specifications

The 20x4 LCD module displays 20 characters per line across 4 lines (80 characters total). The display uses an I2C interface with a PCF8574 backpack adapter, requiring only two GPIO pins (SDA and SCL) for communication. The I2C address is typically 0x27, though some modules use 0x3F. The LCD includes an adjustable-contrast blue potentiometer on the backpack board and a white-on-blue backlit display for visibility in low-light conditions.

#### 5.3.1.2 Button Layout and Functions

Five momentary push buttons are arranged in a row for easy access:

| Button | GPIO Pin | Primary Function | Long-Press Function |
|--------|----------|------------------|---------------------|
| BTN1 | GPIO 15 | Temperature/Humidity Detail | None |
| BTN2 | GPIO 19 | Gas/LPG & Air Quality Detail | None |
| BTN3 | GPIO 13 | Smoke Detection Detail | None |
| BTN4 | GPIO 14 | Carbon Monoxide Detail | None |
| BTN5 | GPIO 27 | System Information | WiFi Reconfiguration (2s hold) |

All buttons are wired in active-low configuration (button press connects GPIO to ground), with internal pull-up resistors enabled in software. This configuration eliminates the need for external resistors and simplifies wiring.

#### 5.3.1.3 Display Response and User Feedback

When a button is pressed, the LCD responds immediately (within 100 milliseconds) by clearing the screen and displaying the requested information. Previous firmware versions included a sliding animation transition between screens, but this was removed to improve responsiveness based on user feedback indicating that delays were frustrating during alarm conditions.

The display remains on the selected screen for 15 seconds after the last button press, then automatically returns to the default overview screen. This timeout ensures that the most informative overview is displayed most of the time while still allowing users to review detailed information when needed.

During active alarm conditions, the LCD overrides button presses and displays a dedicated alarm screen with red background (if color LCD) or flashing text (on monochrome LCD), showing which sensor triggered the alarm and current readings. This alarm screen persists until the alarm condition clears or is silenced.

### 5.3.2 Web Dashboard (Progressive Web App)

The web dashboard is the primary interface for remote monitoring and system configuration. Implemented as a Progressive Web App (PWA), it combines the accessibility of a website with the functionality and user experience of a native mobile application.

#### 5.3.2.1 Progressive Web App Technology

A Progressive Web App is a web application that uses modern web capabilities to deliver an app-like experience to users. FireWire's PWA implementation includes three essential components:

**1. HTTPS Encryption**

The entire application is served over HTTPS (Hypertext Transfer Protocol Secure), encrypting all data transmitted between the user's device and the server. This encryption protects sensitive information such as login credentials, sensor data, and session tokens from interception. Render.com provides automatic HTTPS with SSL/TLS certificates at no additional cost.

**2. Web App Manifest**

The manifest.json file is a JSON document that describes the application to the browser and operating system. FireWire's manifest specifies:
- Application name: "FireWire - Smart Fire Monitoring"
- Short name: "FireWire" (displayed under the home screen icon)
- Start URL: "/" (the page that opens when launching the installed app)
- Display mode: "standalone" (opens without browser UI, appearing as a native app)
- Theme color: "#ff5722" (deep orange, used for the Android status bar)
- Background color: "#0a0a0a" (dark background for the splash screen)

When a user visits the FireWire URL in a compatible browser (Chrome, Edge, Safari), the browser detects the manifest and offers to install the app to the device's home screen. Once installed, the app icon appears alongside native applications, and tapping it opens FireWire in standalone mode without the browser's address bar or navigation buttons.

**3. Service Worker**

The service worker (sw.js) is a JavaScript file that runs in the background, separate from the web page, even when the browser is closed. FireWire's service worker handles push notifications, allowing the system to alert users to fire alarms even when they are not actively using the application. The service worker lifecycle includes:

- **Installation**: When the user first visits the site, the browser downloads and installs sw.js
- **Activation**: The service worker takes control of the page and begins listening for events
- **Push Event Handling**: When the server sends a push notification, the service worker receives it, displays the notification with appropriate title, body text, icon, and action buttons, and handles user interactions (opening the dashboard or dismissing the notification)
- **Background Operation**: The service worker remains active in the background, consuming minimal resources, ready to receive push notifications at any time



#### 5.3.2.2 Dashboard Installation Process

The installation process varies slightly by platform but follows a similar pattern:

**Android (Chrome Browser)**
1. Open https://cloud-alarm.onrender.com in Chrome
2. Chrome automatically displays an "Add to Home Screen" banner at the bottom of the screen
3. Alternatively, tap the three-dot menu icon and select "Add to Home Screen"
4. Confirm the installation by tapping "Add"
5. The FireWire icon appears on the home screen
6. Tapping the icon opens the app in standalone mode

**iOS (Safari Browser)**
1. Open the URL in Safari (note: Chrome on iOS does not support PWA installation)
2. Tap the Share button (square with upward arrow) at the bottom of the screen
3. Scroll down and tap "Add to Home Screen"
4. Edit the name if desired and tap "Add"
5. The icon appears on the home screen
6. Note: iOS has limited push notification support for PWAs; notifications may not work when the app is closed

**Desktop (Chrome, Edge, or Brave)**
1. Open the URL in a compatible browser
2. Look for the install icon (⊕ or computer monitor icon) in the address bar
3. Click the icon and confirm installation
4. The app opens in a standalone window and appears in the Start Menu (Windows) or Applications folder (Mac)
5. The app can be pinned to the taskbar for quick access

#### 5.3.2.3 Dashboard Layout and Features

The dashboard is organized into several functional sections, all accessible from a single-page interface:

**Header Section**
- FireWire logo and system name
- Current date and time (updates every second)
- Device status indicator (Online/Offline with colored badge)
- Last update timestamp showing when the most recent sensor data was received
- Language toggle button (English/Filipino)
- User menu with logout option

**Sensor Monitoring Cards (6 Cards in Grid Layout)**

Each sensor is displayed in a dedicated card with consistent formatting:

1. **Gas/LPG Leak Card**
   - Horizontal progress bar showing current gas level as percentage
   - Numerical value display
   - Color-coded status: Green (safe, <20%), Yellow (caution, 20-32%), Orange (warning, 32-40%), Red (danger, ≥40%)
   - Plain-language status text: "Safe," "Caution," "Warning," or "Danger"

2. **Smoke Detected Card**
   - Progress bar and percentage display
   - Color-coded by smoke level
   - Status text with actionable guidance

3. **Carbon Monoxide (CO) Card**
   - Circular gauge display showing PPM value
   - Color-coded zones: Green (<35 PPM), Yellow (35-99 PPM), Orange (100-399 PPM), Red (≥400 PPM)
   - Dynamic status hint: "Safe," "Caution — open windows," "Danger — leave area," or "Critical — evacuate now"

4. **Air Quality Card**
   - Circular gauge showing AQI value
   - Color-coded zones based on air quality index standards
   - Status categories: "Good" (0-50), "Moderate" (51-100), "Poor" (101-150), "Unhealthy" (>150)

5. **Room Temperature Card**
   - Progress bar with temperature in degrees Celsius
   - Status based on Philippine climate norms: "Cool" (<26°C), "Normal" (26-33°C), "Warm" (34-36°C), "Hot" (37-40°C), "Very Hot" (>40°C)
   - Color-coded: Blue (cool), Green (normal), Yellow (warm), Orange (hot), Red (very hot)

6. **Humidity Card**
   - Progress bar showing relative humidity percentage
   - Status based on Philippine typical humidity: "Dry" (<30%), "Low" (30-80%), "Normal" (81-88%), "Humid" (>88%)
   - Color-coded appropriately

All sensor cards have uniform height and consistent styling, with inline status hints displayed in small, muted text after the main status value. This design ensures visual balance and easy scanning of all sensor states at a glance.

**Alarm Status Card**

When no alarm is active, this section displays a green "All Clear" card with a checkmark icon. When an alarm triggers, it transforms into a prominent red card with:
- Pulsing animation to draw attention
- Large "FIRE ALARM ACTIVE" heading
- List of sensors that triggered the alarm with their current readings
- Timestamp of alarm activation
- "Silence Alarm" button (available to both admin and household members)
- If audio alerts are enabled, the browser plays the selected alarm sound in a loop

**Alarm History Tab**

Accessible via a tab selector, the alarm history section displays:
- Chronological list of all past alarm events
- Each entry shows: date/time, duration, triggering sensor(s), peak readings
- Color-coded severity indicators
- "Export to PDF" button (admin only) to generate a printable report
- "Clear History" button (admin only) to delete all records
- Pagination for large history sets (20 entries per page)
- Auto-refresh every 30 seconds to show new alarms

**Settings Tab (Admin Only)**

The settings panel provides configuration controls:

1. **Threshold Sliders**
   - Gas threshold: 10-100% (default 40%)
   - Smoke threshold: 1-20% (default 4%)
   - Temperature threshold: 40-80°C (default 60°C)
   - CO warning threshold: 10-100 PPM (default 35 PPM)
   - CO danger threshold: 50-200 PPM (default 100 PPM)
   - CO critical threshold: 200-600 PPM (default 400 PPM)
   - Each slider displays the current value and updates in real-time as the user drags
   - Changes are transmitted to the ESP32 within 500 milliseconds

2. **Smart Alarm Mode Toggle**
   - Switch to enable/disable smoke-temperature correlation logic
   - Explanation text describes the feature's purpose (reducing cooking false alarms)
   - Current mode status displayed prominently

3. **Alarm Sound Selection**
   - Dropdown menu with three options: 911.mp3, Alarm2.mp3, Alarm3.mp3
   - Preview button to test each sound
   - Selected sound is saved to browser localStorage

4. **Email Alerts Toggle**
   - Enable/disable email notifications for alarm events
   - Displays the admin email address that will receive alerts

5. **Push Notifications**
   - "Enable Notifications" button to subscribe the current device
   - Status indicator showing whether notifications are enabled
   - "Test Notification" button to verify functionality

6. **Factory Reset Button**
   - Requires admin PIN confirmation
   - Warning message explaining that all data will be erased
   - Irreversible action that clears the household from the database

**Statistics Tab**

Displays analytical data and trends:
- Daily, weekly, and monthly sensor reading charts (line graphs)
- CO and AQI status distribution (pie charts)
- Fire risk detection events log
- Average sensor values over selected time periods
- Peak readings and timestamps

#### 5.3.2.4 Multi-Language Support

FireWire includes complete English and Filipino (Tagalog) translations for all user interface text. The language can be toggled via a button in the header, and the selection is saved to localStorage so it persists across sessions. All text strings are defined in translations.js, making it straightforward to add additional languages in the future. The translation system covers:
- All button labels and headings
- Sensor names and status messages
- Alarm notifications and warnings
- Setup wizard instructions
- Error messages and validation feedback
- Help text and tooltips

### 5.3.3 Push Notifications

Push notifications are a critical feature for fire alarm systems, as they enable alerts to reach users even when they are not actively monitoring the dashboard. FireWire implements push notifications using the Web Push API with VAPID (Voluntary Application Server Identification) authentication.

#### 5.3.3.1 Notification Subscription Process

To receive push notifications, users must explicitly grant permission and subscribe their device:

1. **Permission Request**: When the user clicks "Enable Notifications" in the settings tab, the browser displays a permission prompt asking "Allow cloud-alarm.onrender.com to send notifications?" The user must click "Allow."

2. **Service Worker Registration**: The browser registers the service worker (sw.js) if not already registered. The service worker is required to receive push messages in the background.

3. **Push Subscription Creation**: The browser generates a unique push subscription object containing:
   - Endpoint URL: A unique address provided by the browser's push service (Google FCM for Chrome, Mozilla Push for Firefox, APNs for Safari)
   - Public key (p256dh): Used for encrypting push message payloads
   - Authentication secret (auth): Used for message authentication

4. **Subscription Storage**: The subscription object is sent to the FireWire backend via POST /api/push/subscribe. The server stores it in the MongoDB database associated with the user's household.

5. **Confirmation**: The dashboard displays "Notifications Enabled" status, and the user can test the functionality with the "Test Notification" button.

#### 5.3.3.2 Notification Delivery Flow

When an alarm triggers, the following sequence delivers push notifications:

1. **Alarm Detection**: The server detects an alarm state transition (from non-alarm to alarm) when processing sensor data from the ESP32.

2. **Subscription Retrieval**: The server queries MongoDB for all active push subscriptions associated with the household.

3. **Payload Construction**: The server creates a notification payload containing:
   - Title: "🔥 FIRE ALARM ACTIVE"
   - Body: Description of which sensor(s) triggered and current readings
   - Icon: FireWire logo image
   - Badge: Small icon for notification tray
   - Vibration pattern: [200, 100, 200] (vibrate 200ms, pause 100ms, vibrate 200ms)
   - Actions: Two buttons - "Open Dashboard" and "Dismiss"
   - Tag: "fire-alarm" (ensures multiple alarms don't stack; new alarm replaces old)
   - Require interaction: true (notification persists until user interacts)

4. **Encryption and Signing**: The payload is encrypted using the subscription's public key and signed with the server's VAPID private key. This ensures that only the intended recipient can decrypt the message and that the message authentically originates from the FireWire server.

5. **Push Service Transmission**: The server sends the encrypted payload to the browser's push service (Google, Mozilla, or Apple) via HTTPS POST request.

6. **Device Delivery**: The push service delivers the message to the user's device, even if the device is in sleep mode or the browser is closed.

7. **Service Worker Activation**: The device wakes up the service worker, which decrypts the payload and displays the notification using the Notifications API.

8. **User Interaction**: When the user taps the notification:
   - If "Open Dashboard" is tapped: The browser opens or focuses the FireWire dashboard
   - If "Dismiss" is tapped: The notification is closed with no further action
   - If the notification body is tapped: Same as "Open Dashboard"

#### 5.3.3.3 Notification Limitations and Considerations

- **iOS Safari Limitations**: As of 2026, iOS Safari has limited support for web push notifications. Notifications may only work when the PWA is in the foreground. Users on iOS should consider using Android devices or desktop computers for reliable alarm notifications.

- **Battery Impact**: Push notifications have minimal battery impact, as the service worker remains dormant until a message arrives. The device only wakes briefly to display the notification.

- **Network Dependency**: Push notifications require internet connectivity. If the user's device is offline, notifications will not be delivered until connectivity is restored. However, the local alarm (buzzer and LCD) on the ESP32 device continues to function.

- **Browser Compatibility**: Push notifications are supported in Chrome, Edge, Firefox, and Safari (with limitations). Internet Explorer does not support push notifications.

---

## 5.4 Maintenance and Safety

Regular maintenance ensures reliable operation and extends the service life of FireWire components. This section provides procedures for routine maintenance, safety precautions, and troubleshooting common issues.

### 5.4.1 Regular Maintenance Procedures

#### 5.4.1.1 Sensor Calibration

Gas sensors (MQ-2, MQ-7, MQ-135) require periodic calibration to maintain accuracy. Over time, sensor sensitivity may drift due to exposure to contaminants or aging of the sensing element.

**Calibration Frequency**: Monthly calibration is recommended for optimal accuracy. In environments with heavy cooking or industrial activity, calibration every 2 weeks may be beneficial.

**Calibration Procedure**:
1. Ensure the device is in a clean air environment (outdoors or well-ventilated room with no gas sources)
2. Power on the device and allow sensors to warm up for 5 minutes
3. Access the admin settings in the web dashboard
4. Click "Calibrate Sensors" button
5. The ESP32 reads baseline sensor values in clean air and stores them as reference points
6. Calibration completes in approximately 30 seconds
7. Verify that gas, smoke, CO, and AQI readings show near-zero values in clean air

**Calibration Indicators**: The dashboard displays the last calibration date. If more than 45 days have elapsed since the last calibration, a yellow warning badge appears prompting the user to recalibrate.

#### 5.4.1.2 LCD Display Cleaning

The LCD screen may accumulate dust or fingerprints, reducing readability.

**Cleaning Procedure**:
1. Power off the device or disconnect from power source
2. Use a soft, lint-free microfiber cloth slightly dampened with water
3. Gently wipe the LCD surface in one direction
4. Do not use alcohol, ammonia, or abrasive cleaners, as these may damage the LCD coating
5. Do not spray liquid directly onto the LCD; apply to cloth first
6. Allow the screen to air dry completely before powering on

**Contrast Adjustment**: If the LCD text appears too faint or too dark, adjust the blue potentiometer on the I2C backpack board (located on the back of the LCD module). Turn clockwise to increase contrast, counterclockwise to decrease. Adjust while the display is powered on to see the effect in real-time.



#### 5.4.1.3 Battery Maintenance and Replacement

Lithium-ion batteries degrade over time, gradually losing capacity. Proper maintenance extends battery life and ensures reliable backup power.

**Monthly Inspection**:
- Check battery voltage on the dashboard or LCD (should read 3.7-4.2V per cell when fully charged)
- Verify that the charging indicator LED functions correctly when USB power is connected
- Inspect battery terminals for corrosion or loose connections
- Ensure the battery shield's power switch operates smoothly

**Charging Best Practices**:
- Charge batteries before voltage drops below 3.3V per cell to maximize lifespan
- Avoid leaving batteries in a fully discharged state for extended periods
- Use a quality 5V USB power adapter (1A minimum, 2A recommended for faster charging)
- Charge in a well-ventilated area at room temperature (20-25°C optimal)
- Do not charge unattended overnight; disconnect when the green LED indicates full charge

**Battery Replacement Indicators**:
Replace batteries when any of the following conditions occur:
- Runtime drops below 2 hours on a full charge (indicating <50% capacity remaining)
- Batteries fail to reach 4.2V after a full charge cycle
- Physical damage, swelling, or leakage is observed
- Batteries are more than 3 years old (typical 18650 lifespan is 300-500 charge cycles)

**Replacement Procedure**:
1. Power off the device and disconnect USB charging cable
2. Remove the battery shield cover (typically secured with screws)
3. Note the polarity markings (+ and -) on the battery holder
4. Remove old batteries
5. Insert new batteries, ensuring correct polarity (flat negative end toward spring contact)
6. Replace the cover and secure screws
7. Power on and verify that the voltage reading is approximately 3.7-4.0V
8. Perform a full charge cycle before relying on battery power

**Recommended Battery Specifications**:
- Type: 18650 lithium-ion rechargeable
- Capacity: 2500mAh minimum (3000-3500mAh preferred for longer runtime)
- Protection: Protected cells with built-in PCB (prevents over-discharge and over-charge)
- Brand: Samsung, Panasonic, LG, or Sony (avoid unbranded or counterfeit cells)
- Chemistry: Li-ion (not LiFePO4 or other chemistries, which have different voltage characteristics)

#### 5.4.1.4 WiFi Credential Updates

If the home WiFi network name (SSID) or password changes, the ESP32 must be reconfigured:

**Method 1: Using Button 5 (Recommended)**
1. Press and hold Button 5 on the device for 2 seconds
2. The device attempts to reconnect to the saved network
3. If reconnection fails, it activates the "FireWire-Setup" hotspot
4. Connect a smartphone or computer to the "FireWire-Setup" network
5. The captive portal opens automatically
6. Select the new WiFi network and enter the password
7. Submit the form; the device stores the new credentials and connects

**Method 2: Via USB Serial Connection**
1. Connect the ESP32 to a computer via USB cable
2. Open Arduino IDE or a serial terminal (115200 baud rate)
3. Send the command: `RESET_WIFI`
4. The device erases saved credentials and restarts in hotspot mode
5. Follow the captive portal procedure as in Method 1

#### 5.4.1.5 Firmware Updates

Firmware updates may be released to add features, improve performance, or fix bugs. Updates require physical access to the device and a computer with Arduino IDE installed.

**Update Procedure**:
1. Download the latest firmware (.ino file) from the project repository
2. Connect the ESP32 to the computer via USB cable
3. Open the firmware file in Arduino IDE
4. Update config.h with the device's WiFi credentials and device secret (do not change these unless instructed)
5. Select the correct board (ESP32 Dev Module) and COM port in Arduino IDE
6. Click "Upload" to compile and flash the new firmware
7. Wait for the upload to complete (typically 30-60 seconds)
8. Open the Serial Monitor to verify successful boot
9. Check the dashboard to confirm the device reconnects and transmits data

**Backup Before Updating**: Note the current threshold values and settings from the dashboard before updating firmware, as some updates may reset configuration to defaults.

### 5.4.2 Safety Precautions

#### 5.4.2.1 Proper Sensor Placement

Correct installation location is critical for effective fire detection:

**Recommended Placement**:
- **Ceiling Mount**: Install on the ceiling or high on a wall (within 12 inches of the ceiling), as smoke and hot gases rise
- **Central Location**: Position in a central area of the home, such as a hallway or living room, to detect fires from multiple rooms
- **Avoid Dead Air Spaces**: Do not install in corners where air circulation is poor
- **Distance from Cooking Areas**: Install at least 10 feet (3 meters) from stoves and ovens to reduce cooking false alarms, but not so far that kitchen fires go undetected

**Locations to Avoid**:
- Bathrooms or areas with high humidity (steam can trigger false alarms)
- Near air conditioning vents or fans (airflow can dilute smoke before detection)
- Garages (vehicle exhaust may cause false alarms)
- Unheated areas subject to extreme temperatures (sensors may malfunction below 0°C or above 50°C)
- Directly above cooking appliances

#### 5.4.2.2 Sensor Obstruction Prevention

- Do not cover sensors with decorative items, curtains, or furniture
- Maintain at least 6 inches of clearance around the device for proper air circulation
- Do not paint over the sensor openings, as this blocks airflow and reduces sensitivity
- Keep the device free of dust accumulation by gently vacuuming around (not touching) sensors monthly

#### 5.4.2.3 Electrical Safety

- Use only the provided battery shield or a compatible 5V power supply
- Do not attempt to power the ESP32 with voltages exceeding 5V on the VIN pin, as this may damage components
- Ensure all wiring connections are secure and properly insulated
- Do not operate the device with exposed wiring or damaged cables
- If using AC-to-USB power adapters, ensure they are UL-listed or equivalent safety certified
- Install in a dry location; do not expose to rain or water splashes

#### 5.4.2.4 Battery Safety

- Use only genuine 18650 lithium-ion batteries from reputable manufacturers
- Never use damaged, dented, or swollen batteries
- Do not short-circuit battery terminals (keep metal objects away from batteries)
- Do not expose batteries to fire or extreme heat (>60°C)
- Do not attempt to disassemble or modify batteries
- Store spare batteries in a cool, dry place away from flammable materials
- Dispose of old batteries at designated recycling centers; do not throw in regular trash

#### 5.4.2.5 Fire Safety Awareness

**Critical Understanding**: FireWire is a fire detection and monitoring system, not a fire suppression system. It alerts occupants to fire hazards but does not extinguish fires.

**Emergency Response**:
- When an alarm sounds, immediately investigate the cause
- If fire is detected, evacuate all occupants immediately
- Call emergency services (911 in the Philippines: Bureau of Fire Protection hotline 8426-0219)
- Do not attempt to fight large fires; evacuate and wait for professional firefighters
- Have a family fire escape plan and practice it regularly
- Keep fire extinguishers accessible and ensure household members know how to use them

**System Limitations**:
- FireWire cannot detect fires in closed rooms if the door is shut (smoke must reach the sensors)
- Sensor response time is typically 10-30 seconds; fast-spreading fires may require immediate evacuation before the alarm sounds
- Battery-powered operation provides 4-6 hours of backup; extended power outages may exhaust the battery
- The system requires periodic maintenance and calibration to function reliably

#### 5.4.2.6 Child Safety

- Install the device out of reach of young children to prevent tampering with buttons or batteries
- Educate children about the alarm sound and the importance of evacuating when it sounds
- Do not allow children to play with the device or treat alarm tests as games
- Ensure children understand that the device is a safety tool, not a toy

#### 5.4.2.7 Use of Manufacturer-Recommended Parts

- Replace sensors only with the specified models (MQ-2, MQ-7, MQ-135, HDC1080)
- Use compatible 18650 batteries meeting the specifications in Section 5.4.1.3
- Do not substitute components with different voltage or current ratings
- Unauthorized modifications void any warranty and may create safety hazards

### 5.4.3 Troubleshooting Guide

This section provides solutions to common issues users may encounter during operation.

#### Table 5.1: Common Issues and Solutions

| Problem | Possible Cause | Solution |
|---------|---------------|----------|
| **LCD displays blank screen** | Contrast set too low | Adjust the blue potentiometer on the LCD backpack clockwise |
| | Incorrect I2C address | Check if LCD uses address 0x3F instead of 0x27; update code if needed |
| | Loose wiring connection | Verify SDA and SCL connections to GPIO 21 and 22 |
| | Insufficient power | Check that 5V power supply provides at least 1A current |
| **Sensors show constant 0 or 4095** | Sensor not connected | Verify sensor VCC, GND, and analog output connections |
| | Wrong GPIO pin | Confirm MQ-2 on GPIO 33, MQ-7 on GPIO 34, MQ-135 on GPIO 32 |
| | Insufficient warmup time | Allow 2-3 minutes for MQ sensors to heat up after power-on |
| | Sensor failure | Replace the faulty sensor module |
| **WiFi connection fails** | Incorrect credentials | Verify SSID and password in config.h or reconfigure via Button 5 |
| | 5GHz network selected | ESP32 only supports 2.4GHz WiFi; ensure router broadcasts 2.4GHz |
| | Weak signal strength | Move device closer to router or use WiFi extender |
| | Router MAC filtering | Add ESP32's MAC address to router's allowed devices list |
| **Device shows "Offline" on dashboard** | WiFi disconnected | Check router status and ESP32 WiFi connection |
| | Server not receiving data | Verify device secret matches database entry |
| | ESP32 crashed | Power cycle the device (turn off, wait 10 seconds, turn on) |
| | Firewall blocking traffic | Ensure outbound HTTPS (port 443) is allowed |
| **Push notifications not working** | Permission not granted | Check browser notification permissions in browser settings |
| | Service worker not registered | Clear browser cache and reload the page |
| | Subscription expired | Unsubscribe and resubscribe to push notifications |
| | iOS Safari limitations | Use Android or desktop browser for reliable notifications |
| **Battery drains quickly (<2 hours)** | Old or degraded batteries | Replace batteries with new high-capacity cells (2500mAh+) |
| | High WiFi transmission rate | Normal; battery runtime is 4-6 hours under continuous use |
| | Buzzer sounding frequently | Investigate and resolve the alarm condition causing buzzer activation |
| **False alarms from cooking** | High sensitivity mode | Enable Smart Alarm Mode in dashboard settings |
| | Sensor too close to kitchen | Relocate device farther from cooking area (minimum 10 feet) |
| | Sensor needs calibration | Perform sensor calibration in clean air environment |
| **Temperature reading incorrect** | HDC1080 not connected | Verify I2C connections (SDA to GPIO 21, SCL to GPIO 22) |
| | Wrong I2C address | HDC1080 uses address 0x40; verify with I2C scanner |
| | Sensor near heat source | Move device away from direct sunlight, heaters, or AC vents |
| **Dashboard not loading** | Server sleeping (free tier) | Wait 30-60 seconds for Render.com server to wake up |
| | Browser cache issue | Clear browser cache and reload page |
| | Network connectivity | Check internet connection on the client device |
| **Cannot log in as admin** | Incorrect PIN | Verify PIN is correct; PINs are case-sensitive if alphanumeric |
| | OTP expired | Request a new OTP; codes expire after 10 minutes |
| | Email not received | Check spam folder; verify Gmail address is correct |
| | Session token expired | Tokens expire after 7 days; log in again |

#### 5.4.3.1 Advanced Diagnostics

For issues not resolved by the troubleshooting table, advanced diagnostics may be necessary:

**Serial Monitor Debugging**:
1. Connect the ESP32 to a computer via USB cable
2. Open Arduino IDE and select Tools → Serial Monitor
3. Set baud rate to 115200
4. Observe the debug output, which shows:
   - WiFi connection status and IP address
   - Sensor readings in real-time
   - HTTP request/response codes
   - Error messages and stack traces
5. Copy relevant error messages and consult the project documentation or support forum

**I2C Device Scanner**:
If LCD or HDC1080 sensors are not responding, run an I2C scanner sketch to detect connected devices:
```cpp
#include <Wire.h>

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);  // SDA, SCL
  Serial.println("Scanning I2C bus...");
  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.printf("Device found at 0x%02X\n", addr);
    }
  }
}

void loop() {}
```
Expected output: Devices at 0x27 (or 0x3F) for LCD and 0x40 for HDC1080.

**Network Connectivity Test**:
Use the ping command to verify the ESP32 can reach the server:
1. Note the ESP32's IP address from the LCD or serial monitor
2. From a computer on the same network, open Command Prompt (Windows) or Terminal (Mac/Linux)
3. Type: `ping <ESP32_IP_address>`
4. Verify that replies are received
5. Type: `ping cloud-alarm.onrender.com`
6. Verify that the server is reachable from the network

#### 5.4.3.2 When to Contact Technical Support

Contact technical support if:
- The device does not power on after verifying power supply and battery connections
- Smoke or burning smell emanates from the device (immediately disconnect power)
- Sensor readings remain erratic after calibration and sensor replacement
- The ESP32 repeatedly crashes or reboots (indicated by continuous restarts in serial monitor)
- Database connection errors persist despite correct credentials
- The issue is not covered in this troubleshooting guide

**Support Channels**:
- Email: [Insert support email address]
- Project repository: [Insert GitHub or GitLab URL]
- Community forum: [Insert forum URL if available]

When contacting support, provide:
- Detailed description of the problem
- Steps already taken to troubleshoot
- Serial monitor output (if available)
- Dashboard screenshots showing error messages
- Device ID and firmware version

---

## 5.5 System Configuration

### 5.5.1 Initial Setup

First-time setup is performed through a guided 3-step wizard accessible when the system is brand new or after a factory reset.

#### Step 1: Google Account Verification

1. Open https://cloud-alarm.onrender.com in a web browser
2. The setup wizard detects that no household exists and displays the welcome screen
3. Click "Sign in with Google" button
4. A Google OAuth popup window opens
5. Select the Google account to associate with FireWire (this will be the admin account)
6. Grant permission for FireWire to access the email address
7. Google returns an authentication token to FireWire
8. The server sends a 6-digit OTP (One-Time Password) to the Gmail address
9. Check email and enter the 6-digit code in the setup wizard
10. Click "Verify Code"
11. If the code is correct and entered within 10 minutes, proceed to Step 2

#### Step 2: Credential Creation

The wizard prompts for the following information:

**Household Name** (Required, 3-50 characters)
- Example: "Santos Family Home" or "Apartment 3B"
- This name appears in the dashboard header and email alerts

**Admin Name** (Required, 2-30 characters)
- Example: "Juan" or "Maria Santos"
- Used for personalization in the dashboard

**Home Password** (Required, 6-20 characters)
- This password is shared with all household members for login
- Choose a memorable but secure password
- Example: "FireSafe2026"

**Admin PIN** (Required, 4-6 digits)
- Numeric PIN for admin authentication and sensitive operations
- Example: "1234" or "987654"
- This PIN is hashed with SHA-256 before storage; it cannot be recovered if forgotten

**Family Code** (Required, exactly 6 digits)
- Shared with trusted household members for their login
- Example: "123456"
- Keep this code confidential; anyone with this code can view sensor data

**Device ID** (Optional, defaults to "ESP32_001")
- Unique identifier for the ESP32 device
- Only change if managing multiple devices
- Must match the DEVICE_ID in the ESP32's config.h file

#### Step 3: Completion and Email Confirmation

1. Review all entered information
2. Click "Complete Setup"
3. The server creates the household record in MongoDB
4. A device secret (random 32-character string) is generated for ESP32 authentication
5. An email is sent to the admin's Gmail address containing:
   - Household name and admin name
   - Home password (for reference)
   - Family code (to share with household members)
   - Device ID and device secret (for ESP32 configuration)
   - Dashboard URL
6. The setup wizard closes and the login screen appears
7. Log in using the newly created credentials

**Important**: Save the setup confirmation email in a secure location. The device secret is required if the ESP32 needs to be reconfigured or replaced.



### 5.5.2 Threshold Configuration

Threshold values determine when sensors trigger alarm conditions. Admin users can adjust these values to suit their specific environment and risk tolerance.

#### 5.5.2.1 Gas Threshold

**Default Value**: 40%
**Adjustable Range**: 10-100%
**Recommendation**: 30-50% for typical residential use

The gas threshold represents the percentage of combustible gas concentration relative to the sensor's maximum detection range. Lower values increase sensitivity but may cause false alarms from minor gas leaks or cooking activities. Higher values reduce false alarms but may delay detection of dangerous gas accumulations.

**Adjustment Procedure**:
1. Log in as admin
2. Navigate to the Settings tab
3. Locate the "Gas Threshold" slider
4. Drag the slider to the desired value or click the +/- buttons
5. The new value is displayed in real-time
6. Release the slider; the value is automatically saved to the database
7. The ESP32 receives the new threshold within 500 milliseconds during its next command poll

#### 5.5.2.2 Smoke Threshold

**Default Value**: 4%
**Adjustable Range**: 1-20%
**Recommendation**: 3-6% for typical residential use

The smoke threshold represents the percentage of smoke particle concentration. Very low values (1-2%) provide maximum sensitivity but may trigger from cooking smoke, candles, or incense. Higher values (8-10%) reduce false alarms but may delay detection of smoldering fires.

**Special Consideration**: If Smart Alarm Mode is enabled, smoke detection alone (without temperature rise) triggers only a warning, not a full alarm. This allows lower smoke thresholds without excessive false alarms from cooking.

#### 5.5.2.3 Temperature Threshold

**Default Value**: 60°C
**Adjustable Range**: 40-80°C
**Recommendation**: 55-65°C for typical residential use

The temperature threshold triggers an alarm when ambient temperature exceeds the set value. In the Philippine climate, typical indoor temperatures range from 26-33°C. A threshold of 60°C provides a significant margin above normal conditions while still detecting fires before they become uncontrollable.

**Considerations**:
- Attic or ceiling-mounted devices may experience higher ambient temperatures (35-40°C) during hot afternoons
- Devices near windows with direct sunlight may require higher thresholds (65-70°C)
- Lower thresholds (50-55°C) provide earlier warning but may cause false alarms in hot, poorly ventilated spaces

#### 5.5.2.4 Carbon Monoxide Thresholds

Carbon monoxide detection uses three progressive thresholds corresponding to health impact levels:

**CO Warning Threshold**
- **Default Value**: 35 PPM
- **Adjustable Range**: 10-100 PPM
- **Health Impact**: Prolonged exposure (>8 hours) may cause headaches in sensitive individuals
- **Action**: Yellow warning displayed; no alarm sound; ventilation recommended

**CO Danger Threshold**
- **Default Value**: 100 PPM
- **Adjustable Range**: 50-200 PPM
- **Health Impact**: Headache, dizziness, nausea within 1-2 hours
- **Action**: Full alarm activated; push notifications sent; immediate ventilation required

**CO Critical Threshold**
- **Default Value**: 400 PPM
- **Adjustable Range**: 200-600 PPM
- **Health Impact**: Life-threatening; unconsciousness within 1 hour, death within 2-3 hours
- **Action**: Full alarm with critical priority; evacuation required

**Recommendation**: Do not adjust CO thresholds above default values unless specifically advised by a safety professional. The default values are based on OSHA (Occupational Safety and Health Administration) and WHO (World Health Organization) guidelines.

### 5.5.3 User Management

#### 5.5.3.1 Adding Household Members

Household members do not require individual accounts. Any person with the Home Password and Family Code can log in as a household member. To grant access to a new household member:

1. Share the Home Password (set during initial setup)
2. Share the 6-digit Family Code
3. Provide the dashboard URL: https://cloud-alarm.onrender.com
4. Instruct the member to:
   - Open the URL in a web browser
   - Select "Household Member Login"
   - Enter the Home Password
   - Enter the Family Code
   - Optionally enter their name for identification
   - Click "Join Household"

The member's session token is created and stored in their browser's localStorage, allowing them to remain logged in for 30 days without re-entering credentials.

#### 5.5.3.2 Revoking Access

To revoke access from a household member:

**Method 1: Change Home Password**
1. Log in as admin
2. Navigate to Settings → Security
3. Click "Change Home Password"
4. Enter current admin PIN for verification
5. Enter new Home Password
6. All existing household member sessions are invalidated
7. Share the new password only with trusted members

**Method 2: Change Family Code**
1. Similar procedure to changing Home Password
2. Enter new 6-digit Family Code
3. All household member sessions are invalidated
4. Share the new code only with trusted members

**Method 3: Factory Reset** (Nuclear Option)
- Erases all data and requires complete setup again
- Use only if admin credentials are lost or system is being transferred to new owners

#### 5.5.3.3 Admin vs Member Permissions

| Capability | Admin | Household Member |
|------------|-------|------------------|
| View sensor data | ✓ | ✓ |
| View alarm status | ✓ | ✓ |
| Silence active alarms | ✓ | ✓ |
| View alarm history | ✓ | ✓ (read-only) |
| Receive push notifications | ✓ | ✓ |
| Change thresholds | ✓ | ✗ |
| Toggle Smart Alarm Mode | ✓ | ✗ |
| Change alarm sound | ✓ | ✗ |
| Enable/disable email alerts | ✓ | ✗ |
| Clear alarm history | ✓ | ✗ |
| Export history to PDF | ✓ | ✗ |
| Calibrate sensors | ✓ | ✗ |
| Change Home Password | ✓ | ✗ |
| Change Family Code | ✓ | ✗ |
| Factory reset | ✓ | ✗ |

#### 5.5.3.4 Session Management

**Session Duration**:
- Admin sessions: 7 days
- Household member sessions: 30 days
- Trusted device tokens (admin): 30 days

**Session Expiration**:
When a session expires, the user is automatically logged out and redirected to the login screen. No data is lost; the user simply needs to log in again.

**Manual Logout**:
Users can manually log out by clicking the user menu icon and selecting "Logout." This immediately invalidates the session token on the server and clears localStorage.

**Multiple Simultaneous Sessions**:
The system supports multiple simultaneous sessions. For example, the admin can be logged in on a desktop computer while a household member is logged in on a smartphone. Each session has its own token and operates independently.

---

## 5.6 Data Management

### 5.6.1 Data Storage

FireWire uses MongoDB Atlas, a cloud-hosted NoSQL database, to store all system data. The database is organized into four primary collections:

#### 5.6.1.1 Households Collection

Stores household account information:
- Household name and admin name
- Admin Gmail address
- Home password (plain text, as it is shared among members)
- Admin PIN (SHA-256 hash only, never plain text)
- Family code (6-digit number)
- Session tokens (admin and household members)
- Trusted device tokens
- Push notification subscriptions
- Email alert preferences
- Creation timestamp

#### 5.6.1.2 Devices Collection

Stores device configuration and current sensor state:
- Device ID (e.g., "ESP32_001")
- Device secret (32-character authentication key)
- Associated household ID (foreign key reference)
- Current sensor readings (gas, smoke, CO, AQI, temperature, humidity, voltage)
- Alarm state (active/inactive)
- Threshold values (gas, smoke, temperature, CO warning/danger/critical)
- Smart Alarm Mode setting
- Siren enabled/disabled
- Last update timestamp
- Device uptime and available memory

#### 5.6.1.3 AlarmHistory Collection

Stores records of all alarm events:
- Alarm ID (unique identifier)
- Device ID (foreign key reference)
- Household ID (foreign key reference)
- Trigger timestamp
- Resolution timestamp (when alarm cleared)
- Duration (in seconds)
- Triggering sensor(s) (gas, smoke, temperature, CO)
- Peak sensor readings during the alarm
- Alarm type (full alarm vs. partial warning)
- Silenced by (admin or household member name)

#### 5.6.1.4 GasHistory Collection

Stores time-series sensor data for trend analysis:
- Timestamp
- Device ID (foreign key reference)
- Gas level (%)
- Smoke level (%)
- CO level (PPM)
- AQI value
- Temperature (°C)
- Humidity (%)

A new GasHistory record is created every time the ESP32 transmits data (approximately every 250 milliseconds), though the server may implement sampling (e.g., storing only every 10th reading) to manage database size.

### 5.6.2 Data Retention Policy

**Current Implementation**: Data is retained indefinitely. All alarm history and gas history records remain in the database unless manually deleted by the admin.

**Recommended Future Enhancement**: Implement automatic data retention policies:
- Alarm history: Retain for 1 year, then archive or delete
- Gas history: Retain detailed (250ms interval) data for 7 days, then downsample to 1-minute averages for 30 days, then downsample to 1-hour averages for 1 year, then delete

### 5.6.3 Privacy and Security

**Data Encryption**:
- All data transmitted between the ESP32, server, and browser is encrypted using HTTPS/TLS
- Data at rest in MongoDB Atlas is encrypted using AES-256 encryption
- Admin PINs are hashed using SHA-256 before storage; plain-text PINs are never stored

**Access Control**:
- Database access is restricted to the Node.js backend server using MongoDB connection strings with authentication
- Users cannot directly access the database; all interactions occur through the REST API
- Session tokens are required for all API requests; expired or invalid tokens are rejected

**Data Ownership**:
- All data belongs to the household that created it
- Admin users can export alarm history to PDF for personal records
- Factory reset permanently deletes all household data from the database

---

## 5.7 Technical Implementation Details

### 5.7.1 Progressive Web App (PWA) Architecture

#### 5.7.1.1 PWA Requirements

FireWire meets all three requirements for Progressive Web App classification:

1. **HTTPS**: The application is served exclusively over HTTPS, provided automatically by Render.com hosting. All HTTP requests are redirected to HTTPS.

2. **Web App Manifest**: The manifest.json file defines the application's name, icons, colors, and display mode, enabling installation to device home screens.

3. **Service Worker**: The sw.js file runs in the background, handling push notifications and enabling offline capabilities (future enhancement).

#### 5.7.1.2 Installation Benefits

Installing FireWire as a PWA provides several advantages over using it as a regular website:

- **Standalone Mode**: The app opens in its own window without browser UI (address bar, tabs), providing a native app experience
- **Home Screen Icon**: Quick access from the device home screen alongside native apps
- **Push Notifications**: Reliable notification delivery even when the browser is closed
- **Faster Loading**: The service worker can cache resources for instant loading (not currently implemented but possible)
- **Offline Capability**: Future enhancement could allow viewing cached sensor data when offline

#### 5.7.1.3 Cross-Platform Compatibility

The PWA approach provides a single codebase that works across all platforms:
- **Android**: Full PWA support in Chrome, Edge, and Samsung Internet
- **iOS**: Partial PWA support in Safari (limited push notifications)
- **Windows**: Full PWA support in Chrome and Edge; can be installed as a desktop app
- **macOS**: Full PWA support in Chrome and Edge
- **Linux**: Full PWA support in Chrome and Firefox

This cross-platform compatibility eliminates the need to develop separate native apps for Android and iOS, significantly reducing development and maintenance costs.

### 5.7.2 Real-Time Communication

#### 5.7.2.1 WebSocket vs HTTP Polling Comparison

FireWire uses WebSocket for real-time data delivery to the dashboard. This section compares WebSocket to the alternative approach of HTTP polling:

**HTTP Polling** (Not Used):
- Browser repeatedly sends HTTP GET requests (e.g., every 1 second) asking "any new data?"
- Server responds with current data or "no change"
- Advantages: Simple to implement, works through all firewalls
- Disadvantages: High bandwidth usage (constant requests even when no data changes), high latency (up to 1 second delay), high server load (thousands of requests per minute per client)

**WebSocket** (Used by FireWire):
- Browser establishes a single persistent connection to the server
- Connection remains open indefinitely
- Server pushes data to browser immediately when it arrives
- Advantages: Low bandwidth (data sent only when it changes), low latency (typically 100-500ms), low server load (one connection per client)
- Disadvantages: Slightly more complex to implement, may be blocked by some corporate firewalls

For a fire alarm system where every second counts, WebSocket's low latency and efficient bandwidth usage make it the superior choice.

#### 5.7.2.2 Connection Management

The WebSocket connection is managed by several mechanisms to ensure reliability:

**Authentication**: When establishing the connection, the browser includes the session token in the URL query string. The server validates this token before accepting the connection.

**Keepalive**: Both client and server send periodic ping/pong messages to prevent idle timeout disconnections imposed by cloud hosting platforms.

**Reconnection**: If the connection drops, the browser automatically attempts to reconnect using exponential backoff (1s, 2s, 4s, 8s, 16s, 30s maximum interval).

**Graceful Degradation**: If WebSocket connection fails repeatedly, the dashboard displays an error message but continues to function using HTTP polling as a fallback (future enhancement).

### 5.7.3 Security Implementation

#### 5.7.3.1 Multi-Layer Security Architecture

FireWire implements defense-in-depth with multiple security layers:

**Layer 1: Transport Encryption (HTTPS/TLS)**
- All network traffic is encrypted using TLS 1.2 or higher
- Prevents eavesdropping and man-in-the-middle attacks

**Layer 2: Authentication**
- Admin: Google OAuth + Email OTP + PIN (three-factor authentication)
- Household Members: Home Password + Family Code (two-factor authentication)
- ESP32 Device: Device ID + Device Secret (two-factor authentication)

**Layer 3: Session Management**
- Cryptographically random 64-character session tokens
- Tokens stored server-side in MongoDB with expiration timestamps
- Tokens transmitted in HTTP Authorization header, never in URL

**Layer 4: Input Validation**
- All user inputs are validated and sanitized on the server
- SQL injection is not applicable (NoSQL database), but NoSQL injection is prevented by using parameterized queries
- Cross-Site Scripting (XSS) is prevented by escaping all user-generated content before display

**Layer 5: Rate Limiting**
- Login attempts are rate-limited to prevent brute-force attacks (maximum 5 attempts per 15 minutes per IP address)
- API requests are rate-limited to prevent denial-of-service attacks

**Layer 6: CORS (Cross-Origin Resource Sharing)**
- The server only accepts requests from the authorized dashboard origin (https://cloud-alarm.onrender.com)
- Prevents malicious websites from making unauthorized API calls

#### 5.7.3.2 Authentication Flow Details

**Admin Login Flow**:
1. User enters Home Password and Gmail address
2. Server verifies Home Password against database
3. Server checks for trusted device token in request
4. If no trusted token: Server generates 6-digit OTP and sends via Gmail SMTP
5. User enters OTP and Admin PIN
6. Server verifies OTP (must be <10 minutes old and unused) and PIN (SHA-256 hash comparison)
7. Server generates session token and stores in database with 7-day expiration
8. If "Remember this device" checked: Server generates trusted device token (30-day expiration)
9. Tokens are returned to browser and stored in localStorage
10. All subsequent API requests include session token in Authorization header

**Household Member Login Flow**:
1. User enters Home Password, Family Code, and optional name
2. Server verifies both credentials against database
3. Server generates session token with 30-day expiration
4. Token is returned and stored in localStorage

**ESP32 Authentication Flow**:
1. ESP32 sends HTTP POST with Device ID in URL and Device Secret in X-Device-Secret header
2. Server queries database for device with matching ID
3. Server compares provided secret with stored secret (exact string match)
4. If match: Request is processed
5. If mismatch: 401 Unauthorized response, data is rejected

---

## 5.8 Limitations and Future Enhancements

### 5.8.1 Current Limitations

#### 5.8.1.1 Internet Dependency for Remote Monitoring

FireWire requires an active internet connection for remote monitoring, push notifications, and data logging. While the local alarm continues to function offline, users away from home cannot monitor sensor status or receive alerts during internet outages. This limitation is inherent to cloud-based systems and represents a trade-off for the benefits of remote access and multi-user monitoring.

#### 5.8.1.2 Free Tier Hosting Constraints

The system is hosted on Render.com's free tier, which imposes a 15-minute inactivity timeout. If no requests are received for 15 minutes, the server enters a sleep state. The next request triggers a cold start, requiring 30-60 seconds for the server to wake up and respond. During this wake-up period, the ESP32's data transmissions may fail, and users accessing the dashboard experience a loading delay.

**Mitigation**: Upgrading to a paid hosting plan ($7-25/month) eliminates the sleep timeout, ensuring 24/7 availability.

#### 5.8.1.3 No Local Data Logging

The ESP32 does not include an SD card module, so sensor readings during offline periods are not stored locally. When connectivity is restored, only current readings are transmitted; historical data from the offline period is lost. This limitation affects the completeness of trend analysis and alarm history.

**Mitigation**: Adding an SD card module ($2-5) and implementing local logging would preserve data during offline periods for later upload.

#### 5.8.1.4 Limited Battery Runtime

The dual 18650 battery configuration provides 4-6 hours of runtime, which may be insufficient during extended power outages. Households experiencing frequent or prolonged outages may find the battery backup inadequate.

**Mitigation**: Using higher-capacity batteries (3500mAh) extends runtime to 6-8 hours. Adding a solar charging panel provides indefinite operation during daylight hours.

#### 5.8.1.5 Single Device Per Household

The current implementation supports one ESP32 device per household. Larger homes or multi-story buildings may require multiple devices for comprehensive coverage, but the system does not currently support this configuration.

**Mitigation**: The database schema and API can be extended to support multiple devices per household with minimal code changes. Each device would have a unique ID and appear as a separate monitoring panel in the dashboard.

### 5.8.2 Recommended Future Enhancements

#### 5.8.2.1 Solar Charging Panel

Integrating a small solar panel (5-10W) with a charge controller would enable continuous operation during power outages, eliminating battery runtime concerns. The panel could be mounted on the roof or near a window with good sunlight exposure.

**Estimated Cost**: ₱500-1,000 for panel and charge controller
**Implementation Complexity**: Low (connect panel to battery shield's charging input)

#### 5.8.2.2 SD Card for Offline Data Logging

Adding an SD card module would allow the ESP32 to log sensor readings locally during offline periods. When connectivity is restored, the device could upload the accumulated data to the cloud, eliminating gaps in historical records.

**Estimated Cost**: ₱100-200 for SD card module and microSD card
**Implementation Complexity**: Medium (requires SPI communication code and file system management)

#### 5.8.2.3 Multiple Device Support

Extending the system to support multiple ESP32 devices per household would enable comprehensive monitoring of large homes, multi-story buildings, or separate structures (e.g., main house and garage).

**Estimated Cost**: ₱3,000-4,000 per additional device
**Implementation Complexity**: Medium (database schema changes, dashboard UI updates to display multiple devices)

#### 5.8.2.4 SMS Alerts via GSM Module

Adding a GSM module (SIM800L or similar) would enable SMS text message alerts as a backup notification channel when internet connectivity is unavailable. This would ensure that users receive fire alarms even during internet outages.

**Estimated Cost**: ₱300-500 for GSM module, plus ongoing cost of prepaid SIM card and SMS charges
**Implementation Complexity**: Medium (requires serial communication with GSM module and AT command handling)

#### 5.8.2.5 Smart Home Integration

Integrating with popular smart home platforms (Google Home, Amazon Alexa, Apple HomeKit) would allow users to receive fire alarm notifications through their existing smart home ecosystems and enable voice commands for status queries.

**Estimated Cost**: No hardware cost (software integration only)
**Implementation Complexity**: High (requires OAuth integration with each platform and compliance with their certification requirements)

#### 5.8.2.6 Machine Learning for False Alarm Reduction

Implementing machine learning algorithms to analyze sensor patterns over time could further reduce false alarms by learning the household's normal activity patterns (cooking times, typical temperature fluctuations, etc.) and distinguishing these from genuine fire conditions.

**Estimated Cost**: No hardware cost (cloud-based ML processing)
**Implementation Complexity**: High (requires data science expertise, training data collection, and model deployment)

---

## 5.9 Summary

This chapter has provided a comprehensive overview of the FireWire system's implementation and operation, covering both technical details and practical user instructions. The system's dual-mode operation (online and offline) ensures reliable fire detection under all circumstances, while the Progressive Web App dashboard provides accessible remote monitoring from any device.

Key takeaways include:

- **Hybrid Operation**: FireWire seamlessly transitions between online and offline modes, maintaining core fire detection functionality regardless of internet connectivity.

- **Multi-Sensor Approach**: The combination of gas, smoke, carbon monoxide, temperature, and humidity sensors provides comprehensive fire hazard detection with cross-sensor correlation to reduce false alarms.

- **User-Friendly Interface**: Both the physical LCD/button interface and the web dashboard are designed for non-technical users, with plain-language status messages and intuitive controls.

- **Robust Security**: Multi-factor authentication, encrypted communications, and session management protect the system from unauthorized access.

- **Maintenance Requirements**: Regular sensor calibration, battery maintenance, and periodic inspection ensure reliable long-term operation.

- **Scalability**: While the current implementation targets single-family homes, the architecture supports future expansion to multiple devices, additional sensors, and integration with smart home ecosystems.

FireWire represents a practical, affordable solution to residential fire safety in the Philippine context, leveraging modern IoT technologies to provide capabilities previously available only in expensive commercial fire alarm systems. By combining local alarm functionality with cloud-based monitoring and notifications, the system offers both reliability and convenience, addressing the critical need for improved fire detection in Filipino households.

