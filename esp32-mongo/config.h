#ifndef CONFIG_H
#define CONFIG_H

// WiFi Configuration
#define WIFI_SSID "Boarding House"
#define WIFI_PASSWORD "Welcome2025"

// Backend Server Configuration
// For local development (uncomment these for local):
// #define API_HOST "192.168.68.122"  // Your computer's IP
// #define API_PORT 3000
// #define USE_HTTPS false

// For production on Render.com:
#define API_HOST "cloud-alarm.onrender.com"
#define API_PORT 443
#define USE_HTTPS true

#ifndef USE_HTTPS
#define USE_HTTPS false
#endif

// Device Configuration
#define DEVICE_ID "ESP32_001"

// Sensor Pins
#define MQ2_PIN 34          // Gas sensor analog pin
#define BUZZER_PIN 25       // Buzzer pin
#define LED_PIN 2           // Built-in LED

// Update Intervals (milliseconds)
#define SENSOR_READ_INTERVAL 500     // Read sensors every 0.5 seconds
#define DATA_SEND_INTERVAL 1000      // Send data every 1 second
#define COMMAND_CHECK_INTERVAL 2000  // Check commands every 2 seconds

// Default Thresholds
#define DEFAULT_GAS_THRESHOLD 40
#define DEFAULT_TEMP_THRESHOLD 60

#endif
