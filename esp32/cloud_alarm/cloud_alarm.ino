/*
  Cloud Fire Alarm System - ESP32 Firmware
  
  Sends sensor data to Firebase Realtime Database
  Receives commands (threshold, silence, arm/disarm) from cloud
*/

#include <WiFi.h>
#include <Wire.h>
#include <ClosedCube_HDC1080.h>
#include <Firebase_ESP_Client.h>
#include <time.h>

// Firebase helper includes
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

#include "config.h"

// ============ Global Objects ============
ClosedCube_HDC1080 hdc;
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// ============ State Variables ============
volatile int alarmThreshold = DEFAULT_THRESHOLD;
volatile int tempAlarmThreshold = TEMP_ALARM_THRESHOLD;
bool alarmState = false;
bool sirenEnabled = true;
bool alarmSilenced = false;
int tempAlarmCounter = 0;

// Sensor filtering
float mq2FilterBuffer[FILTER_SIZE];
int mq2FilterIndex = 0;
float tempFilterBuffer[FILTER_SIZE];
int tempFilterIndex = 0;

// Timing
unsigned long lastSensorRead = 0;
unsigned long lastFirebasePush = 0;
unsigned long lastFirebasePull = 0;
unsigned long lastWifiCheck = 0;

bool firebaseReady = false;

// ============ Function Declarations ============
void setupWiFi();
void setupFirebase();
void readSensors(float &gasPercent, float &temperature, float &humidity, float &voltage);
void pushToFirebase(float gasPercent, float temperature, float humidity, float voltage);
void pullFromFirebase();
void processAlarm(float gasPercent, float temperature);
void addAlarmToHistory(float gasPercent, float temperature, const char* trigger);
String getTimestamp();
float getFilteredMQ2();
float getFilteredTemperature();
float rawToPercent(float raw);

// ============ Setup ============
void setup() {
  Serial.begin(115200);
  delay(200);
  
  Serial.println("\n=== Cloud Fire Alarm System Starting ===");
  
  // Pin setup
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, LOW);
  
  // Initialize filter buffers
  for (int i = 0; i < FILTER_SIZE; i++) {
    mq2FilterBuffer[i] = 0;
    tempFilterBuffer[i] = 25.0;
  }
  
  // ADC setup
  analogReadResolution(12);
  analogSetPinAttenuation(MQ2_ADC_PIN, ADC_11db);
  
  // HDC1080 init
  Wire.begin();
  hdc.begin(0x40);
  Serial.println("HDC1080 initialized");
  
  // Connect WiFi
  setupWiFi();
  
  // Setup Firebase
  setupFirebase();
  
  // NTP config (Philippines UTC+8)
  configTime(8 * 3600, 0, "pool.ntp.org", "time.google.com");
  
  Serial.println("Setup complete!");
}

// ============ Loop ============
void loop() {
  unsigned long now = millis();
  
  // Check WiFi connection
  if (now - lastWifiCheck >= WIFI_CHECK_INTERVAL) {
    lastWifiCheck = now;
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi disconnected, reconnecting...");
      setupWiFi();
    }
  }
  
  // Read sensors
  float gasPercent, temperature, humidity, voltage;
  if (now - lastSensorRead >= SENSOR_READ_INTERVAL) {
    lastSensorRead = now;
    readSensors(gasPercent, temperature, humidity, voltage);
    processAlarm(gasPercent, temperature);
  }
  
  // Push data to Firebase
  if (firebaseReady && now - lastFirebasePush >= FIREBASE_PUSH_INTERVAL) {
    lastFirebasePush = now;
    readSensors(gasPercent, temperature, humidity, voltage);
    pushToFirebase(gasPercent, temperature, humidity, voltage);
  }
  
  // Pull commands from Firebase
  if (firebaseReady && now - lastFirebasePull >= FIREBASE_PULL_INTERVAL) {
    lastFirebasePull = now;
    pullFromFirebase();
  }
  
  // LED indicator
  if (alarmState) {
    digitalWrite(LED_PIN, (millis() / 100) % 2);  // Fast blink
  } else {
    digitalWrite(LED_PIN, (millis() / 1000) % 2); // Slow blink
  }
  
  delay(10);
}


// ============ WiFi Setup ============
void setupWiFi() {
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
  } else {
    Serial.println("\nWiFi connection failed!");
  }
}

// ============ Firebase Setup ============
void setupFirebase() {
  config.api_key = FIREBASE_API_KEY;
  config.database_url = FIREBASE_HOST;
  
  config.token_status_callback = tokenStatusCallback;
  
  // Set buffer sizes
  fbdo.setBSSLBufferSize(4096, 1024);
  fbdo.setResponseSize(2048);
  
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  
  Serial.println("Signing up anonymously...");
  
  // Sign up anonymously (requires Anonymous auth enabled in Firebase Console)
  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("Anonymous sign-up successful!");
  } else {
    Serial.println("Anonymous sign-up failed: " + String(config.signer.signupError.message.c_str()));
  }
  
  // Wait for Firebase to be ready
  unsigned long start = millis();
  while (!Firebase.ready() && millis() - start < 15000) {
    Serial.print(".");
    delay(300);
  }
  Serial.println();
  
  if (Firebase.ready()) {
    firebaseReady = true;
    Serial.println("Firebase connected!");
    
    // Set device online status
    String path = "/devices/" + String(DEVICE_ID) + "/status";
    Firebase.RTDB.setString(&fbdo, path.c_str(), "online");
  } else {
    Serial.println("Firebase connection failed!");
    Serial.println("Error: " + fbdo.errorReason());
  }
}

// ============ Sensor Reading ============
float getFilteredMQ2() {
  int raw = analogRead(MQ2_ADC_PIN);
  mq2FilterBuffer[mq2FilterIndex] = raw;
  mq2FilterIndex = (mq2FilterIndex + 1) % FILTER_SIZE;
  
  float sum = 0;
  for (int i = 0; i < FILTER_SIZE; i++) {
    sum += mq2FilterBuffer[i];
  }
  return sum / FILTER_SIZE;
}

float rawToPercent(float raw) {
  float adcVoltage = raw * (V_REF / ADC_MAX);
  float mq2Voltage = adcVoltage / DIVIDER_RATIO;
  return constrain((mq2Voltage / 5.0) * 100.0, 0.0, 100.0);
}

float getFilteredTemperature() {
  float temp = hdc.readTemperature();
  
  if (isnan(temp) || temp < -40.0 || temp > 125.0) {
    float sum = 0;
    for (int i = 0; i < FILTER_SIZE; i++) {
      sum += tempFilterBuffer[i];
    }
    return sum / FILTER_SIZE;
  }
  
  int prevIndex = (tempFilterIndex - 1 + FILTER_SIZE) % FILTER_SIZE;
  float prevTemp = tempFilterBuffer[prevIndex];
  
  if (prevTemp > 0 && abs(temp - prevTemp) > 20.0) {
    return prevTemp;
  }
  
  tempFilterBuffer[tempFilterIndex] = temp;
  tempFilterIndex = (tempFilterIndex + 1) % FILTER_SIZE;
  
  float sum = 0;
  for (int i = 0; i < FILTER_SIZE; i++) {
    sum += tempFilterBuffer[i];
  }
  return sum / FILTER_SIZE;
}

void readSensors(float &gasPercent, float &temperature, float &humidity, float &voltage) {
  float filteredRaw = getFilteredMQ2();
  gasPercent = rawToPercent(filteredRaw);
  voltage = (filteredRaw * (V_REF / ADC_MAX)) / DIVIDER_RATIO;
  temperature = getFilteredTemperature();
  humidity = hdc.readHumidity();
}

// ============ Firebase Push ============
void pushToFirebase(float gasPercent, float temperature, float humidity, float voltage) {
  String basePath = "/devices/" + String(DEVICE_ID);
  
  // Create JSON for current readings
  FirebaseJson json;
  json.set("gas", gasPercent);
  json.set("temperature", temperature);
  json.set("humidity", humidity);
  json.set("voltage", voltage);
  json.set("alarm", alarmState);
  json.set("sirenEnabled", sirenEnabled);
  json.set("threshold", alarmThreshold);
  json.set("tempThreshold", tempAlarmThreshold);
  json.set("timestamp", getTimestamp());
  json.set("heap", (int)ESP.getFreeHeap());
  
  // Temperature warning level
  String tempWarning = "normal";
  if (temperature >= 65.0) tempWarning = "critical";
  else if (temperature >= 60.0) tempWarning = "high";
  else if (temperature >= 55.0) tempWarning = "warning";
  json.set("tempWarning", tempWarning);
  
  if (Firebase.RTDB.setJSON(&fbdo, (basePath + "/current").c_str(), &json)) {
    Serial.printf("Data pushed: Gas=%.1f%%, Temp=%.1f°C\n", gasPercent, temperature);
  } else {
    Serial.println("Firebase push failed: " + fbdo.errorReason());
  }
}

// ============ Firebase Pull (Commands) ============
void pullFromFirebase() {
  String basePath = "/devices/" + String(DEVICE_ID) + "/commands";
  
  if (Firebase.RTDB.getJSON(&fbdo, basePath.c_str())) {
    FirebaseJson &json = fbdo.jsonObject();
    FirebaseJsonData data;
    
    // Check for threshold update
    if (json.get(data, "threshold") && data.success) {
      int newThreshold = data.intValue;
      if (newThreshold != alarmThreshold && newThreshold >= 5 && newThreshold <= 95) {
        alarmThreshold = newThreshold;
        Serial.printf("Threshold updated from cloud: %d%%\n", alarmThreshold);
      }
    }
    
    // Check for silence command
    if (json.get(data, "silence") && data.success && data.boolValue) {
      alarmSilenced = true;
      digitalWrite(BUZZER_PIN, LOW);
      Serial.println("Alarm silenced from cloud");
      // Clear the command
      Firebase.RTDB.setBool(&fbdo, (basePath + "/silence").c_str(), false);
    }
    
    // Check for siren toggle
    if (json.get(data, "sirenEnabled") && data.success) {
      sirenEnabled = data.boolValue;
      if (!sirenEnabled) digitalWrite(BUZZER_PIN, LOW);
    }
    
    // Check for temperature threshold update
    if (json.get(data, "tempThreshold") && data.success) {
      int newTempThreshold = data.intValue;
      if (newTempThreshold != tempAlarmThreshold && newTempThreshold >= 40 && newTempThreshold <= 80) {
        tempAlarmThreshold = newTempThreshold;
        Serial.printf("Temp threshold updated from cloud: %d°C\n", tempAlarmThreshold);
      }
    }
  }
}


// ============ Alarm Processing ============
void processAlarm(float gasPercent, float temperature) {
  // Temperature alarm logic (using configurable threshold)
  bool tempAlarm = false;
  if (temperature >= tempAlarmThreshold) {
    tempAlarmCounter++;
    if (tempAlarmCounter >= 3) {
      tempAlarm = true;
      Serial.printf("TEMP ALARM! %.1f°C (threshold: %d°C)\n", temperature, tempAlarmThreshold);
    }
  } else {
    tempAlarmCounter = 0;
  }
  
  // Trigger alarm
  if (!alarmState && (gasPercent >= alarmThreshold || tempAlarm)) {
    alarmState = true;
    alarmSilenced = false;
    
    String trigger;
    if (gasPercent >= alarmThreshold && tempAlarm) trigger = "both";
    else if (tempAlarm) trigger = "temperature";
    else trigger = "gas";
    
    addAlarmToHistory(gasPercent, temperature, trigger.c_str());
    Serial.printf("ALARM TRIGGERED! Gas=%.1f%%, Temp=%.1f°C, Trigger=%s\n", 
                  gasPercent, temperature, trigger.c_str());
  }
  
  // Clear alarm
  if (alarmState && gasPercent < (alarmThreshold - HYSTERESIS) && temperature < 50.0) {
    alarmState = false;
    alarmSilenced = false;
    digitalWrite(BUZZER_PIN, LOW);
    Serial.println("Alarm cleared");
  }
  
  // Control buzzer
  if (alarmState && sirenEnabled && !alarmSilenced) {
    digitalWrite(BUZZER_PIN, HIGH);
  } else {
    digitalWrite(BUZZER_PIN, LOW);
  }
}

// ============ Add Alarm to Firebase History ============
void addAlarmToHistory(float gasPercent, float temperature, const char* trigger) {
  String path = "/devices/" + String(DEVICE_ID) + "/history";
  
  FirebaseJson json;
  json.set("timestamp", getTimestamp());
  json.set("gas", gasPercent);
  json.set("temperature", temperature);
  json.set("trigger", trigger);
  
  Firebase.RTDB.pushJSON(&fbdo, path.c_str(), &json);
}

// ============ Get Timestamp ============
String getTimestamp() {
  struct tm timeinfo;
  char buf[30] = "0000-00-00 00:00:00";
  if (getLocalTime(&timeinfo)) {
    strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", &timeinfo);
  } else {
    sprintf(buf, "uptime %lus", millis() / 1000);
  }
  return String(buf);
}
