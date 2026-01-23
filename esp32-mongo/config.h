#ifndef CONFIG_H
#define CONFIG_H

// ============================================
// WiFiManager Configuration (Captive Portal)
// ============================================
// When ESP32 can't connect to saved WiFi, it creates an access point
// Connect to this AP with your phone/laptop to configure WiFi

#define WIFI_AP_NAME "FireWire-Setup"      // AP name when in setup mode
#define WIFI_AP_PASSWORD "firewire123"     // AP password (min 8 chars)
#define WIFI_PORTAL_TIMEOUT 180            // Config portal timeout (seconds)
#define WIFI_FAIL_RESTART_PORTAL 5         // Restart portal after X failed reconnects

// Legacy WiFi credentials (optional fallback, WiFiManager handles this now)
#define WIFI_SSID "ha"
#define WIFI_PASSWORD "yumikawaii369"

// Backend Server Configuration
// For local development (comment out for production):
// #define API_HOST "192.168.1.39"  // Your computer's IP
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
#define DEVICE_SECRET "6195d9a4faa9ef076a21eab5810e4ef8"  // Nailon household

// Sensor Pins
#define MQ2_PIN 33           // MQ-2 Smoke sensor (moved from 35 for better stability)
#define MQ7_PIN 34           // MQ-7 Carbon Monoxide sensor
#define MQ135_PIN 32         // MQ-135 Air Quality sensor
#define BUZZER_PIN 25        // Buzzer pin
#define LED_PIN 2            // Built-in LED

// Button Pins (for LCD display toggle) - Safe pins that don't conflict with sensors
#define BTN1_PIN 15          // Button 1 - Temperature/Humidity view (safe digital pin)
#define BTN2_PIN 19          // Button 2 - Gas Level/Air Quality view
#define BTN3_PIN 13          // Button 3 - Smoke Level view
#define BTN4_PIN 14          // Button 4 - System/WiFi info view
#define BTN5_PIN 12          // Button 5 - Buzzer off/silence

// Update Intervals (milliseconds) - Optimized for fast response
#define SENSOR_READ_INTERVAL 100     // Read sensors every 0.1 seconds (was 200ms)
#define DATA_SEND_INTERVAL 250       // Send data every 0.25 seconds (was 500ms)
#define COMMAND_CHECK_INTERVAL 500   // Check commands every 0.5 seconds (was 1000ms)

// Default Thresholds - Sensitive for testing
#define DEFAULT_GAS_THRESHOLD 5     // Sensitive threshold for testing
#define DEFAULT_SMOKE_THRESHOLD 4   // Minimum threshold for smoke detection  
#define DEFAULT_TEMP_THRESHOLD 60   // Match backend server default

// CO Thresholds (PPM) - Very high to prevent false alarms during sensor warmup
#define DEFAULT_CO_WARNING 500
#define DEFAULT_CO_DANGER 800
#define DEFAULT_CO_CRITICAL 1000

// Sensor Calibration Defaults
#define DEFAULT_CO_RO 200.0       // MQ-7 Ro in clean air (ohms) - adjusted for current ADC readings
#define DEFAULT_AQI_RO 100.0      // MQ-135 Ro in clean air (ohms) - adjusted for current ADC readings
#define LOAD_RESISTANCE 10.0      // Load resistor value (kOhms)

// Warmup Configuration
#define SENSOR_WARMUP_MS 0        // No warmup - show real-time readings immediately

// Moving Average Configuration
#define MOVING_AVG_SAMPLES 10     // Number of samples for smoothing

// Stuck Sensor Detection
#define STUCK_SENSOR_READINGS 60  // Number of identical readings to trigger warning

// LCD Configuration (20x4 I2C LCD with PCF8574 backpack)
#define LCD_ADDRESS 0x27          // Common I2C address (try 0x3F if 0x27 doesn't work)
#define LCD_COLS 20               // 20 columns
#define LCD_ROWS 4                // 4 rows

#endif
 