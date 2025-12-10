/*
  config.h - Configuration for Cloud Fire Alarm System
*/
#ifndef CONFIG_H
#define CONFIG_H

// ======= WiFi Configuration =======
#define WIFI_SSID "Boarding House"
#define WIFI_PASSWORD "Welcome2025"

// ======= Firebase Configuration =======
// TODO: Add your Firebase project details here
#define FIREBASE_HOST "YOUR-PROJECT-ID-default-rtdb.YOUR-REGION.firebasedatabase.app"
#define FIREBASE_API_KEY "YOUR-FIREBASE-API-KEY"

// Device ID (unique identifier for this ESP32)
#define DEVICE_ID "alarm-device-01"

// ======= Pin Configuration =======
#define MQ2_ADC_PIN 34    // ADC1_6
#define BUZZER_PIN  26    // active-high
#define LED_PIN     25

// ======= ADC / Divider Constants =======
#define ADC_MAX 4095      // 12-bit
#define V_REF 3.3f        // ADC ref
#define DIVIDER_RATIO (20.0f / (10.0f + 20.0f)) // 10k/20k divider

// ======= Alarm Settings =======
#define DEFAULT_THRESHOLD 40  // percent (0..100)
#define HYSTERESIS 5          // percent
#define TEMP_ALARM_THRESHOLD 60.0f  // Celsius

// ======= Sensor Filtering =======
#define FILTER_SIZE 5

// ======= Timing Intervals (ms) =======
#define FIREBASE_PUSH_INTERVAL 2000   // Push data every 2 seconds
#define FIREBASE_PULL_INTERVAL 5000   // Check for commands every 5 seconds
#define SENSOR_READ_INTERVAL 1000     // Read sensors every second
#define WIFI_CHECK_INTERVAL 30000     // Check WiFi every 30 seconds

// ======= History Settings =======
#define MAX_LOCAL_HISTORY 20

#endif
