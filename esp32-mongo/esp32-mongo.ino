/*
 * Cloud Fire Alarm - MongoDB Backend Version
 * ESP32 Firmware for sending sensor data to Node.js backend
 * With MQ-7 (CO) and MQ-135 (Air Quality) sensor support
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Preferences.h>
#include "ClosedCube_HDC1080.h"
#include "config.h"

// WiFi clients
WiFiClient wifiClient;
WiFiClientSecure wifiClientSecure;

// HDC1080 Temperature/Humidity Sensor
ClosedCube_HDC1080 hdc1080;

// Preferences for storing calibration
Preferences preferences;

// State variables - existing sensors
float gasPercent = 0;
float temperature = 25.0;  // Start with safe room temp to avoid false alarms
float humidity = 50.0;     // Start with normal humidity
bool tempSensorReady = false;  // Track if we got a valid temp reading
float voltage = 0;
int gasThreshold = DEFAULT_GAS_THRESHOLD;
int tempThreshold = DEFAULT_TEMP_THRESHOLD;
bool alarmActive = false;
bool sirenEnabled = true;
bool silenceRequested = false;
String tempWarning = "normal";

// MQ-7 CO Sensor variables
float coPpm = 0;
int coRaw = 0;
String coStatus = "normal";
float coRo = DEFAULT_CO_RO;
int coWarningThreshold = DEFAULT_CO_WARNING;
int coDangerThreshold = DEFAULT_CO_DANGER;
int coCriticalThreshold = DEFAULT_CO_CRITICAL;

// MQ-135 Air Quality variables
float aqi = 0;
int aqiRaw = 0;
String aqiStatus = "good";
float aqiRo = DEFAULT_AQI_RO;

// Sensor status
bool sensorWarmup = true;
bool fireRisk = false;
String sensorHealth = "ok";
unsigned long bootTime = 0;
unsigned long lastCalibration = 0;

// Moving average buffers
float coReadings[MOVING_AVG_SAMPLES];
float aqiReadings[MOVING_AVG_SAMPLES];
int readingIndex = 0;
int readingCount = 0;

// Stuck sensor detection
int lastCoRaw = -1;
int stuckCoCount = 0;
int lastAqiRaw = -1;
int stuckAqiCount = 0;

// Timing
unsigned long lastSensorRead = 0;
unsigned long lastDataSend = 0;
unsigned long lastCommandCheck = 0;

// Function declarations
void connectWiFi();
void readSensors();
void readGasSensors();
void sendDataToServer();
void checkCommands();
void updateAlarmState();
void activateBuzzer(bool state);
String getTimestamp();
float calculateCOPpm(int rawADC, float ro);
float calculateAQI(int rawADC, float ro);
String getCOStatus(float ppm);
String getAQIStatus(float aqiValue);
float applyMovingAverage(float* buffer, float newValue, int* index, int* count);
void loadCalibration();
void saveCalibration();
void performCalibration();
bool checkSensorStuck(int currentRaw, int* lastRaw, int* stuckCount);

void setup() {
  Serial.begin(115200);
  Serial.println("\n=== Cloud Fire Alarm (MongoDB) ===");
  Serial.println("With MQ-7 (CO) and MQ-135 (AQI) support");
  
  // Record boot time for warmup calculation
  bootTime = millis();
  
  // Initialize pins (MQ-2 removed, using MQ-7 and MQ-135 only)
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(MQ7_PIN, INPUT);
  pinMode(MQ135_PIN, INPUT);
  
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, LOW);
  
  // Initialize HDC1080
  Wire.begin();
  hdc1080.begin(0x40);
  Serial.println("HDC1080 initialized");
  
  // Load calibration from preferences
  loadCalibration();
  
  // Initialize moving average buffers
  for (int i = 0; i < MOVING_AVG_SAMPLES; i++) {
    coReadings[i] = 0;
    aqiReadings[i] = 0;
  }
  
  // Connect to WiFi
  connectWiFi();
  
  Serial.println("Sensors ready - showing real-time readings");
}

void loop() {
  unsigned long now = millis();
  
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, reconnecting...");
    connectWiFi();
  }
  
  // Read sensors
  if (now - lastSensorRead >= SENSOR_READ_INTERVAL) {
    readSensors();
    updateAlarmState();
    lastSensorRead = now;
  }
  
  // Send data to server
  if (now - lastDataSend >= DATA_SEND_INTERVAL) {
    sendDataToServer();
    lastDataSend = now;
  }
  
  // Check for commands
  if (now - lastCommandCheck >= COMMAND_CHECK_INTERVAL) {
    checkCommands();
    lastCommandCheck = now;
  }
  
  // Handle buzzer
  if (alarmActive && sirenEnabled && !silenceRequested) {
    activateBuzzer(true);
  } else {
    activateBuzzer(false);
  }
  
  delay(100);
}

void connectWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    digitalWrite(LED_PIN, HIGH);
    delay(500);
    digitalWrite(LED_PIN, LOW);
  } else {
    Serial.println("\nWiFi connection failed!");
  }
}

void readSensors() {
  // MQ-2 removed - gasPercent now derived from MQ-7 CO readings
  // Will be set in readGasSensors()
  
  // Read HDC1080 with error checking
  float newTemp = hdc1080.readTemperature();
  float newHum = hdc1080.readHumidity();
  
  // Validate readings - HDC1080 returns 125°C on I2C error
  bool validReading = true;
  if (newTemp >= 124.0 || newTemp < -40.0) {
    Serial.println("WARNING: Invalid temperature reading (I2C error), keeping previous value");
    validReading = false;
  }
  if (newHum > 100.0 || newHum < 0.0) {
    Serial.println("WARNING: Invalid humidity reading (I2C error), keeping previous value");
    validReading = false;
  }
  
  if (validReading) {
    temperature = newTemp;
    humidity = newHum;
    tempSensorReady = true;  // Got valid reading
  } else {
    // Don't set tempSensorReady to false - keep last valid reading
    static unsigned long lastReinit = 0;
    if (millis() - lastReinit > 5000) {
      Serial.println("Reinitializing HDC1080...");
      hdc1080.begin(0x40);
      lastReinit = millis();
    }
  }
  
  // Read voltage (ESP32 ADC2 - use different pin since 35 might conflict)
  voltage = 3.3; // Fixed value since we're using pin 35 for other purposes
  
  // Read MQ-7 and MQ-135 gas sensors
  readGasSensors();
  
  // Debug output
  Serial.printf("CO: %.1f PPM (%s), AQI: %.0f (%s), Temp: %.1f°C, Hum: %.1f%%\n",
                coPpm, coStatus.c_str(), aqi, aqiStatus.c_str(), 
                temperature, humidity);
}

void readGasSensors() {
  // No warmup - show real-time readings immediately
  sensorWarmup = false;
  
  // Read MQ-7 on pin 34 (replacing MQ-2 for gas detection)
  coRaw = analogRead(MQ7_PIN);
  
  // Read MQ-135 on pin 32 for AQI
  aqiRaw = analogRead(MQ135_PIN);
  
  // Direct mapping: low ADC = low gas (safe), high ADC = high gas (danger)
  // Your sensors read ~400-500 in clean air = ~10-12% (safe)
  // Gas detection will increase the ADC value
  gasPercent = map(coRaw, 0, 4095, 0, 100);
  gasPercent = constrain(gasPercent, 0, 100);
  
  // AQI from MQ-135 (direct mapping)
  aqi = map(aqiRaw, 0, 4095, 0, 500);
  aqi = constrain(aqi, 0, 500);
  
  // CO PPM calculation (optional, for display)
  coPpm = gasPercent * 5; // Rough estimate: 100% = 500 PPM
  
  // Debug raw values
  Serial.printf("Raw ADC - MQ7: %d, MQ135: %d -> Gas: %.1f%%, AQI: %.0f\n", 
                coRaw, aqiRaw, gasPercent, aqi);
  
  // Set status based on gas percentage (using gasThreshold)
  if (gasPercent >= gasThreshold + 20) {
    coStatus = "critical";
  } else if (gasPercent >= gasThreshold) {
    coStatus = "danger";
  } else if (gasPercent >= gasThreshold - 10) {
    coStatus = "warning";
  } else {
    coStatus = "normal";
  }
  
  // AQI status
  if (aqi > 150) {
    aqiStatus = "unhealthy";
  } else if (aqi > 100) {
    aqiStatus = "unhealthy_sensitive";
  } else if (aqi > 50) {
    aqiStatus = "moderate";
  } else {
    aqiStatus = "good";
  }
  
  sensorHealth = "ok";
  fireRisk = false;
}

float calculateCOPpm(int rawADC, float ro) {
  if (rawADC <= 0 || ro <= 0) return 0;
  
  float voltage = (rawADC / 4095.0) * 3.3;
  if (voltage <= 0) return 0;
  
  float rs = ((3.3 * LOAD_RESISTANCE) / voltage) - LOAD_RESISTANCE;
  if (rs <= 0) return 1000;
  
  float ratio = rs / ro;
  
  // MQ-7 curve: PPM = 10^((log10(ratio) - 0.72) / -0.34 + 2.3)
  float ppm = pow(10, ((log10(ratio) - 0.72) / -0.34) + 2.3);
  return constrain(ppm, 0, 1000);
}

float calculateAQI(int rawADC, float ro) {
  if (rawADC <= 0 || ro <= 0) return 0;
  
  float voltage = (rawADC / 4095.0) * 3.3;
  if (voltage <= 0) return 0;
  
  float rs = ((3.3 * LOAD_RESISTANCE) / voltage) - LOAD_RESISTANCE;
  if (rs <= 0) return 500;
  
  float ratio = rs / ro;
  
  // Map ratio to AQI (lower ratio = more pollution)
  float aqiValue = (1 - min(ratio, 1.0f)) * 625;
  return constrain(aqiValue, 0, 500);
}

String getCOStatus(float ppm) {
  if (ppm >= coCriticalThreshold) return "critical";
  if (ppm >= coDangerThreshold) return "danger";
  if (ppm >= coWarningThreshold) return "warning";
  return "normal";
}

String getAQIStatus(float aqiValue) {
  if (aqiValue > 150) return "unhealthy";
  if (aqiValue > 100) return "unhealthy_sensitive";
  if (aqiValue > 50) return "moderate";
  return "good";
}

float applyMovingAverage(float* buffer, float newValue, int* index, int* count) {
  buffer[*index % MOVING_AVG_SAMPLES] = newValue;
  
  int samples = min(*count + 1, MOVING_AVG_SAMPLES);
  float sum = 0;
  for (int i = 0; i < samples; i++) {
    sum += buffer[i];
  }
  
  if (*count < MOVING_AVG_SAMPLES) (*count)++;
  (*index)++;
  
  return sum / samples;
}

bool checkSensorStuck(int currentRaw, int* lastRaw, int* stuckCount) {
  if (currentRaw == *lastRaw) {
    (*stuckCount)++;
  } else {
    *stuckCount = 0;
  }
  *lastRaw = currentRaw;
  
  // Check if stuck at min or max for too long
  return (*stuckCount >= STUCK_SENSOR_READINGS) && 
         (currentRaw == 0 || currentRaw >= 4095);
}

void loadCalibration() {
  preferences.begin("gasSensor", true); // Read-only
  coRo = preferences.getFloat("coRo", DEFAULT_CO_RO);
  aqiRo = preferences.getFloat("aqiRo", DEFAULT_AQI_RO);
  lastCalibration = preferences.getULong("lastCal", 0);
  preferences.end();
  
  Serial.printf("Loaded calibration: CO Ro=%.0f, AQI Ro=%.0f\n", coRo, aqiRo);
}

void saveCalibration() {
  preferences.begin("gasSensor", false); // Read-write
  preferences.putFloat("coRo", coRo);
  preferences.putFloat("aqiRo", aqiRo);
  preferences.putULong("lastCal", millis());
  preferences.end();
  
  lastCalibration = millis();
  Serial.println("Calibration saved to flash");
}

void performCalibration() {
  Serial.println("Starting sensor calibration...");
  Serial.println("Ensure sensors are in clean air!");
  
  // Take multiple readings and average
  float coSum = 0, aqiSum = 0;
  const int samples = 50;
  
  for (int i = 0; i < samples; i++) {
    int coRawCal = analogRead(MQ7_PIN);
    int aqiRawCal = analogRead(MQ135_PIN);
    
    float coVoltage = (coRawCal / 4095.0) * 3.3;
    float aqiVoltage = (aqiRawCal / 4095.0) * 3.3;
    
    if (coVoltage > 0) {
      coSum += ((3.3 * LOAD_RESISTANCE) / coVoltage) - LOAD_RESISTANCE;
    }
    if (aqiVoltage > 0) {
      aqiSum += ((3.3 * LOAD_RESISTANCE) / aqiVoltage) - LOAD_RESISTANCE;
    }
    
    delay(100);
  }
  
  coRo = coSum / samples;
  aqiRo = aqiSum / samples;
  
  // Sanity check
  if (coRo < 1000 || coRo > 100000) coRo = DEFAULT_CO_RO;
  if (aqiRo < 1000 || aqiRo > 100000) aqiRo = DEFAULT_AQI_RO;
  
  saveCalibration();
  Serial.printf("Calibration complete: CO Ro=%.0f, AQI Ro=%.0f\n", coRo, aqiRo);
}

void updateAlarmState() {
  // Gas alarm when MQ-7 reading exceeds threshold
  bool gasAlarm = gasPercent >= gasThreshold;
  
  // Only trigger temp alarm if sensor is ready AND temp is valid (not I2C error value)
  bool tempAlarm = tempSensorReady && temperature >= tempThreshold && temperature < 100.0;
  
  // Combined alarm state - gas OR temp triggers alarm
  alarmActive = gasAlarm || tempAlarm;
  
  // Temperature warning levels
  if (temperature >= tempThreshold) {
    tempWarning = "critical";
  } else if (temperature >= tempThreshold - 5) {
    tempWarning = "high";
  } else if (temperature >= tempThreshold - 10) {
    tempWarning = "warning";
  } else {
    tempWarning = "normal";
  }
  
  // Reset silence when alarm clears
  if (!alarmActive) {
    silenceRequested = false;
  }
  
  // LED indicator - blink fast for fire risk, solid for other alarms
  if (fireRisk) {
    static unsigned long lastBlink = 0;
    if (millis() - lastBlink > 100) {
      digitalWrite(LED_PIN, !digitalRead(LED_PIN));
      lastBlink = millis();
    }
  } else {
    digitalWrite(LED_PIN, alarmActive ? HIGH : LOW);
  }
}

void sendDataToServer() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  
  String url;
  if (USE_HTTPS) {
    url = String("https://") + API_HOST + "/api/device/" + DEVICE_ID + "/data";
    wifiClientSecure.setInsecure();
    http.begin(wifiClientSecure, url);
  } else {
    url = String("http://") + API_HOST + ":" + String(API_PORT) + "/api/device/" + DEVICE_ID + "/data";
    http.begin(wifiClient, url);
  }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Secret", DEVICE_SECRET);
  
  // Build JSON payload with gas sensor data
  StaticJsonDocument<768> doc;
  
  // Existing sensor data
  doc["gas"] = gasPercent;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["voltage"] = voltage;
  doc["threshold"] = gasThreshold;
  doc["tempThreshold"] = tempThreshold;
  doc["alarm"] = alarmActive;
  doc["tempWarning"] = tempWarning;
  doc["sirenEnabled"] = sirenEnabled;
  doc["heap"] = ESP.getFreeHeap();
  doc["timestamp"] = getTimestamp();
  
  // MQ-7 CO sensor data
  doc["coPpm"] = coPpm;
  doc["coRaw"] = coRaw;
  doc["coStatus"] = coStatus;
  
  // MQ-135 AQI sensor data
  doc["aqi"] = aqi;
  doc["aqiRaw"] = aqiRaw;
  doc["aqiStatus"] = aqiStatus;
  
  // Sensor status
  doc["sensorWarmup"] = sensorWarmup;
  doc["fireRisk"] = fireRisk;
  doc["sensorHealth"] = sensorHealth;
  
  // Calibration info
  doc["coRo"] = coRo;
  doc["aqiRo"] = aqiRo;
  doc["lastCalibration"] = lastCalibration;
  
  String payload;
  serializeJson(doc, payload);
  
  int httpCode = http.POST(payload);
  
  if (httpCode > 0) {
    Serial.printf("Data sent, response: %d\n", httpCode);
  } else {
    Serial.printf("HTTP error: %s\n", http.errorToString(httpCode).c_str());
  }
  
  http.end();
}

void checkCommands() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  
  String url;
  if (USE_HTTPS) {
    url = String("https://") + API_HOST + "/api/device/" + DEVICE_ID + "/commands";
    wifiClientSecure.setInsecure();
    http.begin(wifiClientSecure, url);
  } else {
    url = String("http://") + API_HOST + ":" + String(API_PORT) + "/api/device/" + DEVICE_ID + "/commands";
    http.begin(wifiClient, url);
  }
  http.addHeader("X-Device-Secret", DEVICE_SECRET);
  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String response = http.getString();
    
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, response);
    
    if (!error) {
      // Existing commands
      if (doc.containsKey("threshold")) {
        gasThreshold = doc["threshold"].as<int>();
        Serial.printf("Gas threshold updated: %d%%\n", gasThreshold);
      }
      
      if (doc.containsKey("tempThreshold")) {
        tempThreshold = doc["tempThreshold"].as<int>();
        Serial.printf("Temp threshold updated: %d°C\n", tempThreshold);
      }
      
      if (doc.containsKey("sirenEnabled")) {
        sirenEnabled = doc["sirenEnabled"].as<bool>();
        Serial.printf("Siren %s\n", sirenEnabled ? "enabled" : "disabled");
      }
      
      if (doc.containsKey("silence") && doc["silence"].as<bool>()) {
        silenceRequested = true;
        Serial.println("Alarm silenced");
      }
      
      // CO threshold commands
      if (doc.containsKey("coWarningThreshold")) {
        coWarningThreshold = doc["coWarningThreshold"].as<int>();
        Serial.printf("CO warning threshold updated: %d PPM\n", coWarningThreshold);
      }
      
      if (doc.containsKey("coDangerThreshold")) {
        coDangerThreshold = doc["coDangerThreshold"].as<int>();
        Serial.printf("CO danger threshold updated: %d PPM\n", coDangerThreshold);
      }
      
      if (doc.containsKey("coCriticalThreshold")) {
        coCriticalThreshold = doc["coCriticalThreshold"].as<int>();
        Serial.printf("CO critical threshold updated: %d PPM\n", coCriticalThreshold);
      }
      
      // Calibration command
      if (doc.containsKey("calibrate") && doc["calibrate"].as<bool>()) {
        Serial.println("Calibration requested from server");
        performCalibration();
      }
    }
  }
  
  http.end();
}

void activateBuzzer(bool state) {
  static bool lastState = false;
  static unsigned long lastToggle = 0;
  
  if (state) {
    // Pulsing buzzer pattern
    if (millis() - lastToggle >= 500) {
      lastState = !lastState;
      digitalWrite(BUZZER_PIN, lastState ? HIGH : LOW);
      lastToggle = millis();
    }
  } else {
    digitalWrite(BUZZER_PIN, LOW);
    lastState = false;
  }
}

String getTimestamp() {
  // Simple timestamp - in production, use NTP
  unsigned long ms = millis();
  unsigned long secs = ms / 1000;
  unsigned long mins = secs / 60;
  unsigned long hrs = mins / 60;
  
  char buf[20];
  sprintf(buf, "%02lu:%02lu:%02lu", hrs % 24, mins % 60, secs % 60);
  return String(buf);
}
