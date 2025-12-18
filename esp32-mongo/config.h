#ifndef CONFIG_H
#define CONFIG_H

// WiFi Configuration
#define WIFI_SSID "Converge_5GHz_58BD"
#define WIFI_PASSWORD "MykEyA5H"

// Backend Server Configuration
// For local development (comment these out for production):
// #define API_HOST "192.168.100.22"  // Your computer's IP
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
#define DEVICE_SECRET "d2cfb70a02782d6cbc2f1578a3b918a3"  // My Family household

// Sensor Pins
#define MQ2_PIN 34          // Gas/smoke sensor analog pin (existing)
#define MQ7_PIN 35          // MQ-7 Carbon Monoxide sensor analog pin
#define MQ135_PIN 32        // MQ-135 Air Quality sensor analog pin
#define BUZZER_PIN 25       // Buzzer pin
#define LED_PIN 2           // Built-in LED

// Update Intervals (milliseconds)
#define SENSOR_READ_INTERVAL 200     // Read sensors every 0.2 seconds
#define DATA_SEND_INTERVAL 500       // Send data every 0.5 seconds
#define COMMAND_CHECK_INTERVAL 1000  // Check commands every 1 second

// Default Thresholds
#define DEFAULT_GAS_THRESHOLD 40
#define DEFAULT_TEMP_THRESHOLD 60

// CO Thresholds (PPM) - Higher values to prevent false alarms
#define DEFAULT_CO_WARNING 100
#define DEFAULT_CO_DANGER 200
#define DEFAULT_CO_CRITICAL 500

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
