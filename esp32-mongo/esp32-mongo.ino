/*
 * Cloud Fire Alarm - MongoDB Backend Version
 * ESP32 Firmware for sending sensor data to Node.js backend
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include "ClosedCube_HDC1080.h"
#include "config.h"

// WiFi clients
WiFiClient wifiClient;
WiFiClientSecure wifiClientSecure;

// HDC1080 Temperature/Humidity Sensor
ClosedCube_HDC1080 hdc1080;

// State variables
float gasPercent = 0;
float temperature = 0;
float humidity = 0;
float voltage = 0;
int gasThreshold = DEFAULT_GAS_THRESHOLD;
int tempThreshold = DEFAULT_TEMP_THRESHOLD;
bool alarmActive = false;
bool sirenEnabled = true;
bool silenceRequested = false;
String tempWarning = "normal";

// Timing
unsigned long lastSensorRead = 0;
unsigned long lastDataSend = 0;
unsigned long lastCommandCheck = 0;

// Function declarations
void connectWiFi();
void readSensors();
void sendDataToServer();
void checkCommands();
void updateAlarmState();
void activateBuzzer(bool state);
String getTimestamp();

void setup() {
  Serial.begin(115200);
  Serial.println("\n=== Cloud Fire Alarm (MongoDB) ===");
  
  // Initialize pins
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(MQ2_PIN, INPUT);
  
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, LOW);
  
  // Initialize HDC1080
  Wire.begin();
  hdc1080.begin(0x40);
  Serial.println("HDC1080 initialized");
  
  // Connect to WiFi
  connectWiFi();
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
  // Read MQ2 gas sensor - simple and fast
  int gasRaw = analogRead(MQ2_PIN);
  gasPercent = map(gasRaw, 0, 4095, 0, 100);
  gasPercent = constrain(gasPercent, 0, 100);
  
  // Read HDC1080 with error checking
  // 125°C and 100% humidity indicate I2C communication errors (0xFFFF)
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
  
  // Only update if readings are valid
  if (validReading) {
    temperature = newTemp;
    humidity = newHum;
  } else {
    // Try reinitializing the sensor on error
    static unsigned long lastReinit = 0;
    if (millis() - lastReinit > 5000) {
      Serial.println("Reinitializing HDC1080...");
      hdc1080.begin(0x40);
      lastReinit = millis();
    }
  }
  
  // Read voltage (ESP32 internal)
  voltage = analogRead(35) * (3.3 / 4095.0) * 2; // Assuming voltage divider
  
  // Debug output
  Serial.printf("Gas: %.1f%%, Temp: %.1f°C, Hum: %.1f%%, V: %.2fV%s\n",
                gasPercent, temperature, humidity, voltage,
                validReading ? "" : " [CACHED]");
}

void updateAlarmState() {
  bool gasAlarm = gasPercent >= gasThreshold;
  bool tempAlarm = temperature >= tempThreshold;
  
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
  
  // LED indicator
  digitalWrite(LED_PIN, alarmActive ? HIGH : LOW);
}

void sendDataToServer() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  
  String url;
  if (USE_HTTPS) {
    url = String("https://") + API_HOST + "/api/device/" + DEVICE_ID + "/data";
    wifiClientSecure.setInsecure(); // Skip certificate verification
    http.begin(wifiClientSecure, url);
  } else {
    url = String("http://") + API_HOST + ":" + String(API_PORT) + "/api/device/" + DEVICE_ID + "/data";
    http.begin(wifiClient, url);
  }
  http.addHeader("Content-Type", "application/json");
  
  // Build JSON payload
  StaticJsonDocument<512> doc;
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
  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String response = http.getString();
    
    StaticJsonDocument<256> doc;
    DeserializationError error = deserializeJson(doc, response);
    
    if (!error) {
      // Process commands
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
