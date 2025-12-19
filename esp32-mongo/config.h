#ifndef CONFIG_H
#define CONFIG_H

// WiFi Configuration
#define WIFI_SSID "Converge_2.4GHz_58BD"
#define WIFI_PASSWORD "P@ssW0rd369"

// Backend Server Configuration
// For local development:
#define API_HOST "192.168.1.39"  // Your computer's IP
#define API_PORT 3000
#define USE_HTTPS false

// For production on Render.com (comment out for local):
// #define API_HOST "cloud-alarm.onrender.com"
// #define API_PORT 443
// #define USE_HTTPS true

#ifndef USE_HTTPS
#define USE_HTTPS false
#endif

// Device Configuration
#define DEVICE_ID "ESP32_001"
#define DEVICE_SECRET "6195d9a4faa9ef076a21eab5810e4ef8"  // Nailon household

// Sensor Pins (MQ-2 removed, using MQ-7 and MQ-135 only)
#define MQ7_PIN 34          // MQ-7 Carbon Monoxide sensor (was MQ2 pin)
#define MQ135_PIN 32        // MQ-135 Air Quality sensor
#define BUZZER_PIN 25       // Buzzer pin
#define LED_PIN 2           // Built-in LED

// Update Intervals (milliseconds)
#define SENSOR_READ_INTERVAL 200     // Read sensors every 0.2 seconds
#define DATA_SEND_INTERVAL 500       // Send data every 0.5 seconds
#define COMMAND_CHECK_INTERVAL 1000  // Check commands every 1 second

// Default Thresholds
#define DEFAULT_GAS_THRESHOLD 40
#define DEFAULT_TEMP_THRESHOLD 60

// CO Thresholds (PPM) - Very high to prevent false alarms during sensor warmup
#define DEFAULT_CO_WARNING 500
#define DEFAULT_CO_DANGER 800
#define DEFAULT_CO_CRITICAL 1000

// Sensor Calibration Defaults
#define DEFAULT_CO_RO 10000.0     // MQ-7 Ro in clean air (ohms)
#define DEFAULT_AQI_RO 10000.0    // MQ-135 Ro in clean air (ohms)
#define LOAD_RESISTANCE 10.0      // Load resistor value (kOhms)

// Warmup Configuration
#define SENSOR_WARMUP_MS 0        // No warmup - show real-time readings immediately

// Moving Average Configuration
#define MOVING_AVG_SAMPLES 10     // Number of samples for smoothing

// Stuck Sensor Detection
#define STUCK_SENSOR_READINGS 60  // Number of identical readings to trigger warning

#endif
