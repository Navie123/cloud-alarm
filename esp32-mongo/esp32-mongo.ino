/*
 * FireWire - ESP32 Smart Fire Alarm System
 * ESP32 Firmware for sending sensor data to Node.js backend
 * With MQ-7 (CO) and MQ-135 (Air Quality) sensor support
 * WiFiManager for easy WiFi configuration via captive portal
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Preferences.h>
#include <WiFiManager.h>  // WiFiManager library for captive portal
#include <LiquidCrystal_I2C.h>  // LCD library
#include "ClosedCube_HDC1080.h"
#include "config.h"

// WiFi clients
WiFiClient wifiClient;
WiFiClientSecure wifiClientSecure;

// WiFiManager instance
WiFiManager wifiManager;

// HDC1080 Temperature/Humidity Sensor
ClosedCube_HDC1080 hdc1080;

// LCD Display
LiquidCrystal_I2C lcd(LCD_ADDRESS, LCD_COLS, LCD_ROWS);

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

// Partial warning system variables
bool partialWarningActive = false;
unsigned long lastPartialBeep = 0;
int partialBeepCount = 0;
bool partialBeepState = false;
const unsigned long PARTIAL_BEEP_INTERVAL = 800;  // 800ms interval between beeps
const unsigned long PARTIAL_BEEP_DURATION = 200;  // 200ms beep duration
const int PARTIAL_BEEP_SEQUENCE = 3;  // 3 beeps per sequence
const unsigned long PARTIAL_SEQUENCE_PAUSE = 2000;  // 2 second pause between sequences

// Warning mode beep variables (1-second intervals)
unsigned long lastWarningBeep = 0;
bool warningBeepState = false;
const unsigned long WARNING_BEEP_INTERVAL = 1000;  // 1 second interval
const unsigned long WARNING_BEEP_DURATION = 300;   // 300ms beep duration

// Temperature baseline for smart smoke detection
float baselineTemp = 25.0;  // Average temperature baseline
float tempReadings[10];     // Store last 10 temperature readings for baseline
int tempReadingIndex = 0;
bool tempBaselineReady = false;

// MQ-2 Smoke Sensor variables
float smokePercent = 0;
int smokeRaw = 0;
String smokeStatus = "normal";
int smokeThreshold = DEFAULT_SMOKE_THRESHOLD;  // Separate threshold for smoke

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

// WiFi Manager config portal trigger
bool configPortalActive = false;
bool wifiResetRequested = false;  // Server can request WiFi reset

// LCD Display Mode (controlled by buttons)
int displayMode = 0;  // 0=Default, 1=Temp/Humidity, 2=Gas/AQI, 3=Smoke, 4=System/WiFi
unsigned long lastButtonPress = 0;
const unsigned long DEBOUNCE_DELAY = 100;  // Reduced debounce for faster response
const unsigned long AUTO_RETURN_DELAY = 20000;  // Return to default after 20s
unsigned long lastModeChange = 0;

// LCD Animation variables
bool isAnimating = false;
unsigned long animationStart = 0;
const unsigned long ANIMATION_DURATION = 150;  // Reduced from 500ms to 150ms
int animationStep = 0;
bool warningMode = false;  // True when showing warning screen

// Function declarations
void connectWiFiManager();
void connectWiFiDirect();
void connectWiFi();
void readSensors();
void readGasSensors();
void sendDataToServer();
void checkCommands();
void updateAlarmState();
void activateBuzzer(bool state);
void updateLCD();
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
void resetWiFiSettings();
void blinkSetupMode();

void setup() {
  Serial.begin(115200);
  
  // IMMEDIATELY set buzzer LOW to prevent startup beep
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  
  Serial.println("\n=== FireWire Smart Fire Alarm ===");
  Serial.println("With MQ-7 (CO) and MQ-135 (AQI) support");
  Serial.println("WiFiManager enabled for easy setup");
  
  // Record boot time for warmup calculation
  bootTime = millis();
  
  // Initialize other pins
  pinMode(LED_PIN, OUTPUT);
  pinMode(MQ2_PIN, INPUT);
  pinMode(MQ7_PIN, INPUT);
  pinMode(MQ135_PIN, INPUT);
  
  // Initialize button pins with internal pull-up resistors and stronger pull-up
  pinMode(BTN1_PIN, INPUT_PULLUP);  // Temp/Humidity
  pinMode(BTN2_PIN, INPUT_PULLUP);  // Gas Level/Air Quality
  pinMode(BTN3_PIN, INPUT_PULLUP);  // Smoke Level
  pinMode(BTN4_PIN, INPUT_PULLUP);  // System/WiFi
  pinMode(BTN5_PIN, INPUT_PULLUP);  // Buzzer Off
  
  // Test button pins at startup
  Serial.println("Testing button pins at startup:");
  Serial.printf("BTN1 (GPIO %d): %d\n", BTN1_PIN, digitalRead(BTN1_PIN));
  Serial.printf("BTN2 (GPIO %d): %d\n", BTN2_PIN, digitalRead(BTN2_PIN));
  Serial.printf("BTN3 (GPIO %d): %d\n", BTN3_PIN, digitalRead(BTN3_PIN));
  Serial.printf("BTN4 (GPIO %d): %d\n", BTN4_PIN, digitalRead(BTN4_PIN));
  Serial.printf("BTN5 (GPIO %d): %d\n", BTN5_PIN, digitalRead(BTN5_PIN));
  
  // Keep buzzer off
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, LOW);
  
  // Check for reset button (hold during boot to reset WiFi)
  // Using built-in BOOT button on GPIO 0
  pinMode(0, INPUT_PULLUP);
  if (digitalRead(0) == LOW) {
    Serial.println("BOOT button held - resetting WiFi settings...");
    resetWiFiSettings();
  }
  
  // Initialize HDC1080 with retry
  Wire.begin();
  delay(100);  // Give I2C time to stabilize
  hdc1080.begin(0x40);
  delay(50);
  
  // Initialize LCD (20x4)
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("====================");
  lcd.setCursor(0, 1);
  lcd.print("   FireWire v1.0    ");
  lcd.setCursor(0, 2);
  lcd.print(" Smart Fire Alarm   ");
  lcd.setCursor(0, 3);
  lcd.print("    Starting...     ");
  Serial.println("LCD 20x4 initialized");
  delay(1500);
  
  // Try to get initial reading
  float testTemp = hdc1080.readTemperature();
  float testHum = hdc1080.readHumidity();
  if (testTemp < 124.0 && testTemp > -40.0) {
    temperature = testTemp;
    tempSensorReady = true;
  }
  if (testHum <= 100.0 && testHum >= 0.0) {
    humidity = testHum;
  }
  Serial.printf("HDC1080 initialized - Temp: %.1f°C, Hum: %.1f%%\n", temperature, humidity);
  
  // Load calibration from preferences
  loadCalibration();
  
  // Initialize moving average buffers
  for (int i = 0; i < MOVING_AVG_SAMPLES; i++) {
    coReadings[i] = 0;
    aqiReadings[i] = 0;
  }
  
  // Setup WiFiManager Connection (Auto-connect mode)
  connectWiFiManager();
  
  // Fetch thresholds from server on startup
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("Fetching thresholds from server...");
    delay(1000);  // Give server time to be ready
    checkCommands();  // This will get any pending threshold commands
    delay(500);   // Allow time for processing
    Serial.printf("After server sync - Gas: %d%%, Smoke: %d%%, Temp: %d°C\n", 
                  gasThreshold, smokeThreshold, tempThreshold);
  } else {
    Serial.println("WiFi not connected - using default thresholds");
  }
  
  Serial.println("Sensors ready - showing real-time readings");
  Serial.printf("Current thresholds - Gas: %d%%, Smoke: %d%%, Temp: %d°C\n", 
                gasThreshold, smokeThreshold, tempThreshold);
}

void loop() {
  unsigned long now = millis();
  static unsigned long lastLCDUpdate = 0;
  
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, reconnecting...");
    connectWiFi();
  }
  
  // Check buttons for display mode change
  checkButtons();
  
  // Auto-return to default display after timeout (unless in alarm/warning mode)
  if (!alarmActive && !warningMode && displayMode != 0 && (now - lastModeChange > AUTO_RETURN_DELAY)) {
    displayMode = 0;
    startSlideAnimation();
  }
  
  // Read sensors
  if (now - lastSensorRead >= SENSOR_READ_INTERVAL) {
    readSensors();
    updateAlarmState();
    lastSensorRead = now;
  }
  
  // Update LCD every 200ms (was 500ms) for faster response
  if (now - lastLCDUpdate >= 200) {
    updateLCD();
    lastLCDUpdate = now;
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
  
  // Handle buzzer logic
  if (alarmActive && sirenEnabled && !silenceRequested) {
    // Full alarm - continuous buzzer
    activateBuzzer(true);
    partialBeepCount = 0;  // Reset partial beep counter
    Serial.println("[BUZZER] Full alarm - continuous");
  } else if (partialWarningActive && sirenEnabled && !silenceRequested) {
    // Partial warning - 3 beeps with 800ms intervals, then 2 second pause
    unsigned long now = millis();
    
    Serial.printf("[BUZZER] Partial warning - beepCount=%d, beepState=%s, timeSinceLastBeep=%lu\n", 
                  partialBeepCount, partialBeepState ? "ON" : "OFF", now - lastPartialBeep);
    
    if (partialBeepCount < PARTIAL_BEEP_SEQUENCE) {
      // Currently in beeping sequence
      if (!partialBeepState && (now - lastPartialBeep >= PARTIAL_BEEP_INTERVAL)) {
        // Start a beep
        partialBeepState = true;
        activateBuzzer(true);
        lastPartialBeep = now;
        partialBeepCount++;
        Serial.printf("[Partial Beep] Beep %d of %d\n", partialBeepCount, PARTIAL_BEEP_SEQUENCE);
      } else if (partialBeepState && (now - lastPartialBeep >= PARTIAL_BEEP_DURATION)) {
        // End the beep
        partialBeepState = false;
        activateBuzzer(false);
        lastPartialBeep = now;
        Serial.printf("[Partial Beep] End beep %d\n", partialBeepCount);
      }
    } else {
      // Sequence complete, wait for pause period
      if (now - lastPartialBeep >= PARTIAL_SEQUENCE_PAUSE) {
        partialBeepCount = 0;  // Reset for next sequence
        Serial.println("[Partial Beep] Starting new sequence");
      } else {
        activateBuzzer(false);  // Ensure buzzer is off during pause
      }
    }
  } else if (warningMode && sirenEnabled && !silenceRequested) {
    // Warning mode - 1 second interval beeps (beep for 300ms, pause for 700ms)
    unsigned long now = millis();
    
    if (!warningBeepState && (now - lastWarningBeep >= WARNING_BEEP_INTERVAL)) {
      // Start a beep
      warningBeepState = true;
      activateBuzzer(true);
      lastWarningBeep = now;
      Serial.println("[BUZZER] Warning mode - beep start");
    } else if (warningBeepState && (now - lastWarningBeep >= WARNING_BEEP_DURATION)) {
      // End the beep
      warningBeepState = false;
      activateBuzzer(false);
      lastWarningBeep = now;
      Serial.println("[BUZZER] Warning mode - beep end");
    }
    
    partialBeepCount = 0;  // Reset partial beep counter
  } else {
    // No alarm - buzzer off
    activateBuzzer(false);
    partialBeepState = false;  // Reset beep state
    partialBeepCount = 0;  // Reset beep counter
    warningBeepState = false;  // Reset warning beep state
  }
  
  delay(100);
}

void connectWiFiManager() {
  Serial.println("Starting WiFiManager auto-connect...");
  
  // Clean, readable CSS with high contrast
  const char* customCSS = "<style>"
    "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');"
    
    "* { margin: 0; padding: 0; box-sizing: border-box; }"
    
    "body { "
      "background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); "
      "color: #212529; "
      "font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; "
      "min-height: 100vh; "
      "line-height: 1.5; "
    "}"
    
    ".wrap { "
      "max-width: 400px; "
      "margin: 0 auto; "
      "padding: 40px 20px; "
      "min-height: 100vh; "
      "display: flex; "
      "flex-direction: column; "
      "justify-content: center; "
    "}"
    
    "h1 { "
      "font-size: 2.5em; "
      "font-weight: 600; "
      "text-align: center; "
      "margin-bottom: 8px; "
      "background: linear-gradient(135deg, #ff6b35 0%, #ff8c42 100%); "
      "-webkit-background-clip: text; "
      "-webkit-text-fill-color: transparent; "
      "background-clip: text; "
    "}"
    
    "h2, h3 { "
      "color: #495057; "
      "text-align: center; "
      "font-weight: 500; "
      "margin-bottom: 30px; "
    "}"
    
    ".c { "
      "text-align: center; "
      "margin-bottom: 20px; "
    "}"
    
    "/* Clean Card Design */"
    ".card, form { "
      "background: white; "
      "border-radius: 16px; "
      "padding: 30px; "
      "margin: 20px 0; "
      "box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); "
      "border: 1px solid rgba(0, 0, 0, 0.05); "
    "}"
    
    "/* Buttons */"
    "input[type='submit'], button, .btn { "
      "background: linear-gradient(135deg, #ff6b35 0%, #ff8c42 100%); "
      "border: none; "
      "color: white; "
      "padding: 14px 24px; "
      "border-radius: 10px; "
      "cursor: pointer; "
      "font-weight: 500; "
      "font-size: 1em; "
      "width: 100%; "
      "margin: 10px 0; "
      "transition: all 0.2s ease; "
      "box-shadow: 0 2px 8px rgba(255, 107, 53, 0.3); "
    "}"
    
    "input[type='submit']:hover, button:hover, .btn:hover { "
      "transform: translateY(-2px); "
      "box-shadow: 0 4px 12px rgba(255, 107, 53, 0.4); "
    "}"
    
    "/* Secondary Buttons */"
    ".btn-secondary { "
      "background: #6c757d !important; "
      "box-shadow: 0 2px 8px rgba(108, 117, 125, 0.3) !important; "
    "}"
    
    "/* Input Fields */"
    "input[type='text'], input[type='password'], select { "
      "width: 100%; "
      "background: #f8f9fa; "
      "border: 2px solid #e9ecef; "
      "color: #212529; "
      "border-radius: 8px; "
      "padding: 12px 16px; "
      "font-size: 1em; "
      "margin: 8px 0; "
      "transition: border-color 0.2s ease; "
    "}"
    
    "input[type='text']:focus, input[type='password']:focus, select:focus { "
      "outline: none; "
      "border-color: #ff6b35; "
      "background: white; "
    "}"
    
    "input::placeholder { "
      "color: #6c757d; "
    "}"
    
    "/* Labels */"
    "label { "
      "display: block; "
      "color: #495057; "
      "font-weight: 500; "
      "margin-bottom: 5px; "
      "font-size: 0.95em; "
    "}"
    
    "/* WiFi Network List */"
    ".q { "
      "background: white; "
      "border: 2px solid #e9ecef; "
      "border-radius: 12px; "
      "margin: 10px 0; "
      "padding: 16px; "
      "cursor: pointer; "
      "transition: all 0.2s ease; "
    "}"
    
    ".q:hover { "
      "border-color: #ff6b35; "
      "background: #fff8f5; "
      "transform: translateY(-1px); "
    "}"
    
    ".l { "
      "color: #212529; "
      "font-weight: 600; "
      "font-size: 1.1em; "
      "display: block; "
      "margin-bottom: 4px; "
    "}"
    
    ".s { "
      "color: #ff6b35; "
      "font-weight: 500; "
      "font-size: 0.9em; "
      "float: right; "
      "background: #fff8f5; "
      "padding: 4px 10px; "
      "border-radius: 15px; "
      "border: 1px solid #ffe5d9; "
    "}"
    
    "/* Status Messages */"
    ".msg { "
      "background: #ff6b35; "
      "color: white; "
      "padding: 12px 16px; "
      "border-radius: 8px; "
      "margin: 15px 0; "
      "font-weight: 500; "
      "text-align: center; "
    "}"
    
    ".error { "
      "background: #dc3545 !important; "
    "}"
    
    ".success { "
      "background: #28a745 !important; "
    "}"
    
    "/* Info Text */"
    ".info { "
      "color: #6c757d; "
      "font-size: 0.9em; "
      "text-align: center; "
      "margin: 10px 0; "
    "}"
    
    "/* Checkbox */"
    "input[type='checkbox'] { "
      "margin-right: 8px; "
      "transform: scale(1.2); "
    "}"
    
    "/* Responsive */"
    "@media (max-width: 480px) { "
      ".wrap { padding: 20px 15px; } "
      ".card, form { padding: 20px; } "
      "h1 { font-size: 2em; } "
    "}"
    
    "/* Clean Dividers */"
    "hr { "
      "border: none; "
      "height: 1px; "
      "background: #e9ecef; "
      "margin: 25px 0; "
    "}"
    
    "</style>";
  
  // Set custom head element with clean, readable styling
  wifiManager.setCustomHeadElement(customCSS);
  
  // Set custom AP name and password for setup mode
  wifiManager.setAPStaticIPConfig(IPAddress(192,168,4,1), IPAddress(192,168,4,1), IPAddress(255,255,255,0));
  
  // Set timeout for config portal
  wifiManager.setConfigPortalTimeout(WIFI_PORTAL_TIMEOUT);
  
  // Try to connect to saved WiFi or start config portal
  if (!wifiManager.autoConnect(WIFI_AP_NAME, WIFI_AP_PASSWORD)) {
    Serial.println("Failed to connect to WiFi and config portal timeout reached");
    Serial.println("Restarting ESP32...");
    delay(3000);
    ESP.restart();
  }
  
  // If we reach here, WiFi is connected
  Serial.println("\nWiFi connected via WiFiManager!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("SSID: ");
  Serial.println(WiFi.SSID());
  Serial.print("Signal: ");
  Serial.print(WiFi.RSSI());
  Serial.println(" dBm");
  
  // Success indication - solid LED for 2 seconds then off
  digitalWrite(LED_PIN, HIGH);
  delay(2000);
  digitalWrite(LED_PIN, LOW);
}

void connectWiFiDirect() {
  Serial.println("Connecting directly to WiFi...");
  Serial.printf("SSID: %s\n", WIFI_SSID);
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  // Blink LED while connecting
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 60) { // 30 seconds timeout
    digitalWrite(LED_PIN, HIGH);
    delay(250);
    digitalWrite(LED_PIN, LOW);
    delay(250);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("SSID: ");
    Serial.println(WiFi.SSID());
    Serial.print("Signal: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    
    // Success indication - solid LED for 2 seconds then off
    digitalWrite(LED_PIN, HIGH);
    delay(2000);
    digitalWrite(LED_PIN, LOW);
  } else {
    Serial.println("\nWiFi connection failed!");
    Serial.println("Restarting ESP32...");
    delay(3000);
    ESP.restart();
  }
}

void connectWiFi() {
  // WiFiManager reconnection - try saved credentials first
  if (WiFi.status() == WL_CONNECTED) return;
  
  Serial.print("Reconnecting to saved WiFi");
  WiFi.reconnect();
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi reconnected!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi reconnection failed");
    Serial.println("Note: Hold BOOT button during restart to reset WiFi settings");
    // Don't auto-restart portal - user can manually reset if needed
  }
}

void resetWiFiSettings() {
  Serial.println("Erasing WiFi credentials...");
  wifiManager.resetSettings();
  
  // Visual feedback - rapid blink
  for (int i = 0; i < 10; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(50);
    digitalWrite(LED_PIN, LOW);
    delay(50);
  }
  
  Serial.println("WiFi settings cleared. Restarting...");
  delay(1000);
  ESP.restart();
}

void blinkSetupMode() {
  static unsigned long lastBlink = 0;
  static bool ledState = false;
  
  if (millis() - lastBlink > 200) {
    ledState = !ledState;
    digitalWrite(LED_PIN, ledState);
    lastBlink = millis();
  }
}

void readSensors() {
  // Read HDC1080 with better error handling
  float newTemp = hdc1080.readTemperature();
  float newHum = hdc1080.readHumidity();
  
  // Validate readings - HDC1080 returns 125°C or -40°C on I2C error
  bool tempValid = (newTemp > -39.0 && newTemp < 85.0);  // Reasonable range
  bool humValid = (newHum >= 0.0 && newHum <= 100.0);
  
  if (tempValid) {
    temperature = newTemp;
    tempSensorReady = true;
    
    // Update temperature baseline (rolling average of last 10 readings)
    tempReadings[tempReadingIndex] = temperature;
    tempReadingIndex = (tempReadingIndex + 1) % 10;
    
    // Calculate baseline after we have enough readings
    if (!tempBaselineReady && tempReadingIndex == 0) {
      tempBaselineReady = true;
    }
    
    if (tempBaselineReady) {
      float sum = 0;
      for (int i = 0; i < 10; i++) {
        sum += tempReadings[i];
      }
      baselineTemp = sum / 10.0;
    }
  } else {
    Serial.printf("WARNING: Invalid temp reading: %.1f°C (I2C error)\n", newTemp);
  }
  
  if (humValid) {
    humidity = newHum;
  } else {
    Serial.printf("WARNING: Invalid humidity reading: %.1f%% (I2C error)\n", newHum);
    // Try to reinitialize sensor
    static unsigned long lastReinit = 0;
    if (millis() - lastReinit > 3000) {
      Serial.println("Reinitializing HDC1080...");
      Wire.end();
      delay(50);
      Wire.begin();
      delay(50);
      hdc1080.begin(0x40);
      lastReinit = millis();
    }
  }
  
  // Read voltage (fixed value)
  voltage = 3.3;
  
  // Read MQ-7 and MQ-135 gas sensors
  readGasSensors();
  
  // Debug output
  Serial.printf("CO: %.1f PPM (%s), AQI: %.0f (%s), Temp: %.1f°C (baseline: %.1f°C), Hum: %.1f%%\n",
                coPpm, coStatus.c_str(), aqi, aqiStatus.c_str(), 
                temperature, baselineTemp, humidity);
}

void readGasSensors() {
  // No warmup - show real-time readings immediately
  sensorWarmup = false;
  
  // Read MQ-2 on pin 35 for smoke detection (take multiple samples)
  long smokeSum = 0;
  for (int i = 0; i < 5; i++) {
    smokeSum += analogRead(MQ2_PIN);
    delayMicroseconds(100);
  }
  smokeRaw = smokeSum / 5;
  
  // Read MQ-7 on pin 34 for CO detection (take multiple samples)
  long coSum = 0;
  for (int i = 0; i < 5; i++) {
    coSum += analogRead(MQ7_PIN);
    delayMicroseconds(100);
  }
  coRaw = coSum / 5;
  
  // Read MQ-135 on pin 32 for AQI (take multiple samples)
  long aqiSum = 0;
  for (int i = 0; i < 5; i++) {
    aqiSum += analogRead(MQ135_PIN);
    delayMicroseconds(100);
  }
  aqiRaw = aqiSum / 5;
  
  // Direct mapping: low ADC = low gas (safe), high ADC = high gas (danger)
  // Sensors read ~400-500 in clean air = ~10-12% (safe)
  // Gas detection will increase the ADC value
  
  // MQ-2 Smoke percentage
  smokePercent = map(smokeRaw, 0, 4095, 0, 100);
  smokePercent = constrain(smokePercent, 0, 100);
  
  // MQ-7 Gas percentage (for backward compatibility with gasPercent)
  gasPercent = map(coRaw, 0, 4095, 0, 100);
  gasPercent = constrain(gasPercent, 0, 100);
  
  // AQI from MQ-135 (proper calculation using Ro)
  aqi = calculateAQI(aqiRaw, aqiRo);
  
  // CO PPM calculation (proper calculation using Ro)
  coPpm = calculateCOPpm(coRaw, coRo);
  
  // Debug raw values with calculation details
  Serial.printf("Raw ADC - MQ2: %d, MQ7: %d, MQ135: %d -> Smoke: %.1f%%, Gas: %.1f%%, AQI: %.0f\n", 
                smokeRaw, coRaw, aqiRaw, smokePercent, gasPercent, aqi);
  
  // Debug CO calculation
  if (coRaw > 0) {
    float coVoltage = (coRaw / 4095.0) * 3.3;
    float coRs = ((3.3 * LOAD_RESISTANCE) / coVoltage) - LOAD_RESISTANCE;
    float coRatio = coRs / coRo;
    Serial.printf("CO Debug - Raw: %d, V: %.3f, Rs: %.1f, Ratio: %.3f, PPM: %.1f\n", 
                  coRaw, coVoltage, coRs, coRatio, coPpm);
    
    // Additional debug for very low readings
    if (coRaw < 50) {
      Serial.printf("CO: Very low ADC (%d) = clean air, PPM set to 0\n", coRaw);
    }
  }
  
  // Debug AQI calculation  
  if (aqiRaw > 0) {
    float aqiVoltage = (aqiRaw / 4095.0) * 3.3;
    float aqiRs = ((3.3 * LOAD_RESISTANCE) / aqiVoltage) - LOAD_RESISTANCE;
    float aqiRatio = aqiRs / aqiRo;
    Serial.printf("AQI Debug - Raw: %d, V: %.3f, Rs: %.1f, Ratio: %.3f, AQI: %.0f\n", 
                  aqiRaw, aqiVoltage, aqiRs, aqiRatio, aqi);
    
    // Additional debug for AQI calculation method
    if (aqiRaw < 30) {
      Serial.printf("AQI: Very low ADC (%d) = excellent air, AQI baseline (5-10)\n", aqiRaw);
    } else if (aqiRaw < 100) {
      Serial.printf("AQI: Low ADC (%d) = good air range (10-20)\n", aqiRaw);
    } else if (aqiRaw < 300) {
      Serial.printf("AQI: Medium ADC (%d) = moderate air range (20-50)\n", aqiRaw);
    } else {
      Serial.printf("AQI: High ADC (%d) = poor air range (50+)\n", aqiRaw);
    }
  }
  
  // Smoke status (MQ-2) - use smokeThreshold properly
  if (smokePercent >= smokeThreshold + 10) {
    smokeStatus = "critical";
  } else if (smokePercent >= smokeThreshold) {
    smokeStatus = "danger";
  } else if (smokePercent >= smokeThreshold * 0.7) {  // 70% of threshold = warning
    smokeStatus = "warning";
  } else {
    smokeStatus = "normal";
  }
  
  // CO status (MQ-7) based on PPM thresholds
  coStatus = getCOStatus(coPpm);
  
  // AQI status based on calculated AQI value
  aqiStatus = getAQIStatus(aqi);
  
  // AQI status (MQ-135)
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
  if (rawADC <= 0 || ro <= 0) return 1;  // Return 1 instead of 0 for baseline
  
  float voltage = (rawADC / 4095.0) * 3.3;
  if (voltage <= 0.01) return 1;  // Baseline reading
  
  float rs = ((3.3 * LOAD_RESISTANCE) / voltage) - LOAD_RESISTANCE;
  if (rs <= 0) return 1;  // Baseline reading
  
  float ratio = rs / ro;
  
  // More sensitive CO calculation - always show some reading
  float ppm;
  
  if (rawADC < 20) {
    // Very low ADC = baseline CO (1-2 PPM)
    ppm = 1 + (rawADC / 20.0);  // 1-2 PPM range
  } else if (rawADC < 100) {
    // Low ADC range = normal indoor CO (2-5 PPM)
    ppm = 2 + ((rawADC - 20) / 80.0) * 3.0;  // 2-5 PPM range
  } else if (rawADC < 300) {
    // Medium ADC range = elevated CO (5-15 PPM)
    ppm = 5 + ((rawADC - 100) / 200.0) * 10.0;  // 5-15 PPM range
  } else if (rawADC < 800) {
    // High ADC range = dangerous CO (15-50 PPM)
    ppm = 15 + ((rawADC - 300) / 500.0) * 35.0;  // 15-50 PPM range
  } else {
    // Very high ADC range = critical CO (50+ PPM)
    ppm = 50 + ((rawADC - 800) / 1000.0) * 100.0;  // 50+ PPM range
  }
  
  // Ensure minimum reading and cap maximum
  if (ppm < 1.0) ppm = 1.0;  // Never show 0
  if (ppm > 200) ppm = 200;  // Cap at dangerous levels
  
  return round(ppm * 10) / 10.0;  // Round to 1 decimal place
}

float calculateAQI(int rawADC, float ro) {
  if (rawADC <= 0 || ro <= 0) return 5;  // Return baseline 5 instead of 0
  
  float voltage = (rawADC / 4095.0) * 3.3;
  if (voltage <= 0.01) return 5;  // Baseline reading for very low voltage
  
  float rs = ((3.3 * LOAD_RESISTANCE) / voltage) - LOAD_RESISTANCE;
  if (rs <= 0) return 5;  // Baseline reading for invalid resistance
  
  float ratio = rs / ro;
  
  // More sensitive AQI calculation - never return 0, always show baseline
  float aqiValue;
  
  if (rawADC < 30) {
    // Very low ADC = excellent air (5-10 AQI baseline)
    aqiValue = 5 + (rawADC / 30.0) * 5.0;  // 5-10 AQI range
  } else if (rawADC < 100) {
    // Low ADC range = good air (10-20 AQI)
    aqiValue = 10 + ((rawADC - 30) / 70.0) * 10.0;
  } else if (rawADC < 300) {
    // Medium ADC range = moderate air (20-50 AQI)
    aqiValue = 20 + ((rawADC - 100) / 200.0) * 30.0;
  } else if (rawADC < 800) {
    // High ADC range = unhealthy for sensitive (50-100 AQI)
    aqiValue = 50 + ((rawADC - 300) / 500.0) * 50.0;
  } else {
    // Very high ADC range = unhealthy (100+ AQI)
    aqiValue = 100 + ((rawADC - 800) / 1000.0) * 100.0;
  }
  
  // Bounds checking - realistic AQI levels, never below 5
  if (aqiValue < 5) return 5;  // Always show minimum baseline of 5
  if (aqiValue > 200) return 200;  // Cap at very unhealthy levels
  
  return round(aqiValue);  // Round to whole number
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
  
  // Force reset to new defaults if old values are too high
  if (coRo > 300 || aqiRo > 300) {
    Serial.println("Old calibration values detected - resetting to new defaults");
    coRo = DEFAULT_CO_RO;
    aqiRo = DEFAULT_AQI_RO;
    saveCalibration();
  }
  
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
  // Gas alarm when MQ-7 reading exceeds gas threshold
  bool gasAlarm = gasPercent >= gasThreshold;
  
  // Temperature alarm when temp exceeds threshold
  bool tempAlarm = tempSensorReady && temperature >= tempThreshold && temperature < 100.0;
  
  // Smart smoke detection logic
  bool smokeDetected = smokePercent >= smokeThreshold;
  bool gasDetected = gasPercent >= gasThreshold;
  bool tempRiseDetected = tempBaselineReady && (temperature > baselineTemp + 5.0);  // Increased from 3°C to 5°C to be less sensitive
  
  // Full alarm conditions (with significant temperature rise)
  bool smokeAlarm = smokeDetected && tempRiseDetected;
  bool gasAlarmWithTemp = gasDetected && tempRiseDetected;
  
  // Partial warning conditions (smoke/gas detected regardless of small temp changes)
  bool smokeWarningOnly = smokeDetected && !tempAlarm;  // Changed: ignore small temp rise, only check temp threshold
  bool gasWarningOnly = gasDetected && !tempAlarm;      // Changed: ignore small temp rise, only check temp threshold
  
  // Combined states
  bool wasAlarm = alarmActive;
  bool wasPartialWarning = partialWarningActive;
  
  // Full alarm: temp threshold OR (smoke/gas + significant temperature rise)
  alarmActive = tempAlarm || smokeAlarm || gasAlarmWithTemp;
  
  // Partial warning: smoke or gas detected but no full alarm
  partialWarningActive = (smokeWarningOnly || gasWarningOnly) && !alarmActive;
  
  // Debug partial warning detection
  if (partialWarningActive != wasPartialWarning) {
    Serial.printf("[DEBUG] Partial Warning State Changed: %s\n", partialWarningActive ? "ACTIVE" : "INACTIVE");
    Serial.printf("[DEBUG] smokeWarningOnly=%s, gasWarningOnly=%s, alarmActive=%s\n", 
                  smokeWarningOnly ? "true" : "false", 
                  gasWarningOnly ? "true" : "false", 
                  alarmActive ? "true" : "false");
  }
  
  // IMMEDIATE DEBUG OUTPUT FOR ALARM TRIGGERS
  static unsigned long lastAlarmDebug = 0;
  if (millis() - lastAlarmDebug > 1000 || alarmActive != wasAlarm || partialWarningActive != wasPartialWarning) {
    Serial.printf("ALARM CHECK: Gas=%.1f%%(>=%d) Smoke=%.1f%%(>=%d) Temp=%.1f°C(>=%d°C) TempRise=%.1f°C -> FULL_ALARM=%s PARTIAL_WARNING=%s\n",
                  gasPercent, gasThreshold, smokePercent, smokeThreshold, temperature, tempThreshold,
                  tempBaselineReady ? (temperature - baselineTemp) : 0,
                  alarmActive ? "YES" : "NO", partialWarningActive ? "YES" : "NO");
    lastAlarmDebug = millis();
  }
  
  // Debug output when states change
  if (alarmActive != wasAlarm || partialWarningActive != wasPartialWarning) {
    Serial.printf("STATE CHANGE: FULL_ALARM=%s | PARTIAL_WARNING=%s\n", 
                  alarmActive ? "ACTIVE" : "CLEARED",
                  partialWarningActive ? "ACTIVE" : "CLEARED");
    Serial.printf("  Gas: %.1f%% vs threshold %d%% -> %s\n", gasPercent, gasThreshold, gasDetected ? "DETECTED" : "ok");
    Serial.printf("  Smoke: %.1f%% vs threshold %d%% -> %s\n", smokePercent, smokeThreshold, smokeDetected ? "DETECTED" : "ok");
    Serial.printf("  Temp: %.1f°C vs threshold %d°C -> %s (sensor ready: %s)\n", 
                  temperature, tempThreshold, tempAlarm ? "TRIGGERED" : "ok", tempSensorReady ? "YES" : "NO");
    Serial.printf("  Temp Rise: %.1f°C vs baseline %.1f°C (rise: %.1f°C) -> %s\n", 
                  temperature, baselineTemp, temperature - baselineTemp, tempRiseDetected ? "YES" : "NO");
    
    if (partialWarningActive) {
      if (smokeWarningOnly && gasWarningOnly) {
        Serial.println("  -> PARTIAL WARNING: Smoke + Gas detected but no full alarm");
      } else if (smokeWarningOnly) {
        Serial.println("  -> PARTIAL WARNING: Smoke detected but no full alarm");
      } else if (gasWarningOnly) {
        Serial.println("  -> PARTIAL WARNING: Gas detected but no full alarm");
      }
    }
  }
  
  // Temperature warning levels (percentage-based for better scaling)
  if (temperature >= tempThreshold) {
    tempWarning = "critical";
  } else if (temperature >= tempThreshold * 0.9) {  // 90% of threshold
    tempWarning = "high";
  } else if (temperature >= tempThreshold * 0.8) {  // 80% of threshold
    tempWarning = "warning";
  } else {
    tempWarning = "normal";
  }
  
  // Reset silence when all alarms clear
  if (!alarmActive && !partialWarningActive && !warningMode) {
    silenceRequested = false;
  }
  
  // LED indicator - blink fast for fire risk, solid for alarms, slow blink for partial warnings
  if (fireRisk) {
    static unsigned long lastBlink = 0;
    if (millis() - lastBlink > 100) {
      digitalWrite(LED_PIN, !digitalRead(LED_PIN));
      lastBlink = millis();
    }
  } else if (alarmActive) {
    digitalWrite(LED_PIN, HIGH);  // Solid for full alarm
  } else if (partialWarningActive) {
    // Slow blink for partial warning
    static unsigned long lastSlowBlink = 0;
    if (millis() - lastSlowBlink > 500) {
      digitalWrite(LED_PIN, !digitalRead(LED_PIN));
      lastSlowBlink = millis();
    }
  } else {
    digitalWrite(LED_PIN, LOW);
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
  StaticJsonDocument<1024> doc;
  
  // Calculate warning status
  bool smokeDetected = smokePercent >= smokeThreshold;
  bool gasDetected = gasPercent >= gasThreshold;
  bool tempRiseDetected = tempBaselineReady && (temperature > baselineTemp + 3.0);
  bool smokeWarningOnly = smokeDetected && !tempRiseDetected;
  bool gasWarningOnly = gasDetected && !tempRiseDetected;
  
  // Existing sensor data
  doc["gas"] = gasPercent;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["voltage"] = voltage;
  doc["threshold"] = gasThreshold;
  doc["smokeThreshold"] = smokeThreshold;
  doc["tempThreshold"] = tempThreshold;
  doc["alarm"] = alarmActive;
  doc["tempWarning"] = tempWarning;
  doc["sirenEnabled"] = sirenEnabled;
  doc["heap"] = ESP.getFreeHeap();
  doc["timestamp"] = getTimestamp();
  
  // Partial warning system data
  doc["partialWarning"] = partialWarningActive;
  doc["smokeWarningOnly"] = smokeWarningOnly;
  doc["gasWarningOnly"] = gasWarningOnly;
  doc["baselineTemp"] = baselineTemp;
  doc["tempRise"] = tempBaselineReady ? (temperature - baselineTemp) : 0;
  
  // MQ-2 Smoke sensor data
  doc["smoke"] = smokePercent;
  doc["smokeRaw"] = smokeRaw;
  doc["smokeStatus"] = smokeStatus;
  
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
  
  // WiFi info
  doc["wifiSSID"] = WiFi.SSID();
  doc["wifiRSSI"] = WiFi.RSSI();
  doc["uptime"] = millis() / 1000;  // Uptime in seconds
  
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
  
  Serial.printf("[CMD] Checking commands... HTTP %d\n", httpCode);
  
  if (httpCode == 200) {
    String response = http.getString();
    Serial.printf("[CMD] Response: %s\n", response.c_str());
    
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
      
      if (doc.containsKey("smokeThreshold")) {
        smokeThreshold = doc["smokeThreshold"].as<int>();
        Serial.printf("Smoke threshold updated: %d%%\n", smokeThreshold);
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
      
      // WiFi reset command from dashboard
      if (doc.containsKey("resetWifi") && doc["resetWifi"].as<bool>()) {
        Serial.println("!!! WiFi RESET REQUESTED FROM SERVER !!!");
        wifiResetRequested = true;
      }
    } else {
      Serial.printf("[CMD] JSON parse error: %s\n", error.c_str());
    }
  } else {
    Serial.printf("[CMD] HTTP error: %d\n", httpCode);
  }
  
  http.end();
  
  // Handle WiFi reset after HTTP connection closed
  if (wifiResetRequested) {
    Serial.println("!!! EXECUTING WIFI RESET NOW !!!");
    wifiResetRequested = false;
    resetWiFiSettings();
  }
}

void activateBuzzer(bool state) {
  // Continuous buzzer - stays on during alarm
  digitalWrite(BUZZER_PIN, state ? HIGH : LOW);
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

// Check button presses for display mode change
void checkButtons() {
  unsigned long now = millis();
  
  // Reduced debounce check for faster response
  if (now - lastButtonPress < DEBOUNCE_DELAY) return;
  
  // Read button states (LOW = pressed because of pull-up)
  bool btn1 = (digitalRead(BTN1_PIN) == LOW);  // Temp/Humidity
  bool btn2 = (digitalRead(BTN2_PIN) == LOW);  // Gas Level/Air Quality
  bool btn3 = (digitalRead(BTN3_PIN) == LOW);  // Smoke Level
  bool btn4 = (digitalRead(BTN4_PIN) == LOW);  // System/WiFi
  bool btn5 = (digitalRead(BTN5_PIN) == LOW);  // Buzzer Off
  
  // Debug button states
  static unsigned long lastDebug = 0;
  if (now - lastDebug > 1000) {  // Debug every second
    if (btn1 || btn2 || btn3 || btn4 || btn5) {
      Serial.printf("Button states: BTN1=%d BTN2=%d BTN3=%d BTN4=%d BTN5=%d\n", 
                    btn1, btn2, btn3, btn4, btn5);
    }
    lastDebug = now;
  }
  
  int newMode = displayMode;
  
  // Button 1 - Temperature/Humidity view
  if (btn1) {
    newMode = 1;
    Serial.println("BTN1 pressed - Temperature/Humidity mode");
  }
  // Button 2 - Gas Level/Air Quality view
  else if (btn2) {
    newMode = 2;
    Serial.println("BTN2 pressed - Gas/AQI mode");
  }
  // Button 3 - Smoke Level view
  else if (btn3) {
    newMode = 3;
    Serial.println("BTN3 pressed - Smoke mode");
  }
  // Button 4 - System/WiFi view
  else if (btn4) {
    newMode = 4;
    Serial.println("BTN4 pressed - System/WiFi mode");
  }
  // Button 5 - Buzzer Off/Silence
  else if (btn5) {
    silenceRequested = true;
    Serial.println("BTN5 pressed - Buzzer silenced");
    
    // Show silence notification screen
    displaySilenceNotification();
    delay(2000);  // Show for 2 seconds
    
    lastButtonPress = now;
    return;
  }
  
  // If mode changed, start slide animation
  if (newMode != displayMode && (btn1 || btn2 || btn3 || btn4)) {
    displayMode = newMode;
    lastModeChange = now;
    lastButtonPress = now;
    
    // Debug output
    Serial.printf("Display mode changed to: %d, starting animation\n", displayMode);
    Serial.printf("Animation start time: %lu\n", millis());
    
    startSlideAnimation();
  }
}

// Start slide animation
void startSlideAnimation() {
  isAnimating = true;
  animationStart = millis();
  animationStep = 0;
  lcd.clear();
  
  // Debug output
  Serial.printf("Starting animation at time: %lu\n", millis());
}

// Update slide animation
void updateAnimation() {
  if (!isAnimating) return;
  
  unsigned long elapsed = millis() - animationStart;
  
  // Force animation to complete if it takes too long (safety timeout)
  if (elapsed >= ANIMATION_DURATION || elapsed >= 1000) {  // Added 1 second safety timeout
    isAnimating = false;
    lcd.clear();  // Clear the loading screen
    Serial.println("Animation completed (or timed out)");
    return;
  }
  
  // Faster animation - show loading dots quickly
  int dots = (elapsed / 30) % 4;  // Changed from 100ms to 30ms
  lcd.setCursor(8, 1);
  lcd.print("Loading");
  lcd.setCursor(8, 2);
  for (int i = 0; i < dots; i++) {
    lcd.print(".");
  }
  for (int i = dots; i < 3; i++) {
    lcd.print(" ");
  }
}

// Check if any sensor is in warning/danger state
bool checkWarningState() {
  // Don't show warnings during the first 15 seconds after startup
  // This allows sensors to stabilize and prevents false warnings
  if (millis() < 15000) {
    return false;
  }
  
  // Check for critical conditions that should trigger warning screen
  bool gasHigh = gasPercent >= gasThreshold * 0.7;  // 70% of threshold (was 80%)
  bool smokeHigh = smokePercent >= smokeThreshold * 0.7;  // 70% of threshold (was 80%)
  bool tempHigh = temperature >= tempThreshold;  // Use actual threshold, not 95%
  bool coHigh = coPpm >= coWarningThreshold * 0.8;  // 80% of CO warning level
  bool aqiPoor = aqi >= 40;  // Moderate or worse AQI (was 50)
  
  return gasHigh || smokeHigh || tempHigh || coHigh || aqiPoor || alarmActive;
}

// Update LCD display with sensor readings (20x4 LCD)
void updateLCD() {
  char buf[25];
  
  // Don't show warnings during the first 15 seconds after startup
  // This allows sensors to stabilize and prevents false warnings
  bool startupPeriod = millis() < 15000;
  
  // Check if we should show warning screen (but not during startup)
  bool shouldShowWarning = !startupPeriod && checkWarningState();
  
  // Handle warning mode transitions
  if (shouldShowWarning && !warningMode) {
    warningMode = true;
    lcd.clear();  // Immediate display, no animation for warnings
  } else if (!shouldShowWarning && warningMode) {
    warningMode = false;
    lcd.clear();  // Immediate display
  }
  
  // Show animation if active
  if (isAnimating) {
    updateAnimation();
    return;
  }
  
  // CRITICAL ALARM MODE - Always show alarm regardless of display mode
  if (alarmActive) {
    displayAlarmScreen();
    return;
  }
  
  // WARNING MODE - Show warning screen for high readings (but not during startup)
  if (warningMode && !startupPeriod) {
    displayWarningScreen();
    return;
  }
  
  // Normal display modes
  switch (displayMode) {
    case 1:  // Temperature & Humidity
      displayTempHumidity();
      break;
    case 2:  // Gas Level & Air Quality
      displayGasAQI();
      break;
    case 3:  // Smoke Level
      displaySmokeLevel();
      break;
    case 4:  // System/WiFi Info
      displaySystemWiFi();
      break;
    default:  // Default clean display (mode 0)
      displayDefault();
      break;
  }
}

// Display silence notification
void displaySilenceNotification() {
  lcd.clear();
  
  // Row 0: Header with checkmark
  lcd.setCursor(0, 0);
  lcd.print("====================");
  lcd.setCursor(5, 0);
  lcd.print("SILENCED");
  
  // Row 1: Checkmark and message
  lcd.setCursor(0, 1);
  lcd.print("    [OK] BUZZER OFF");
  
  // Row 2: Status message
  lcd.setCursor(0, 2);
  lcd.print("  Alarm Acknowledged");
  
  // Row 3: Instruction
  lcd.setCursor(0, 3);
  lcd.print("  Check Environment");
}

// Display Mode 0: Default Clean Display
void displayDefault() {
  char buf[25];
  
  // Row 0: Clean FireWire header
  lcd.setCursor(0, 0);
  lcd.print("====================");
  lcd.setCursor(6, 0);
  lcd.print("FireWire");
  
  // Row 1: Temperature and Humidity with better spacing
  lcd.setCursor(0, 1);
  snprintf(buf, 21, "Temp:%.1fC Hum:%.0f%%", temperature, humidity);
  lcd.print(buf);
  
  // Row 2: Gas and Smoke levels with better formatting
  lcd.setCursor(0, 2);
  snprintf(buf, 21, "Gas:%.0f%% Smoke:%.0f%%", gasPercent, smokePercent);
  lcd.print(buf);
  
  // Row 3: AQI with status
  lcd.setCursor(0, 3);
  String aqiStatusText = "Good";
  if (aqi > 50) aqiStatusText = "Moderate";
  if (aqi > 100) aqiStatusText = "Poor";
  snprintf(buf, 21, "AQI: %.0f (%s)", aqi, aqiStatusText.c_str());
  lcd.print(buf);
}

// Display Mode 1: Temperature & Humidity Detail
void displayTempHumidity() {
  char buf[25];
  
  // Row 0: Header
  lcd.setCursor(0, 0);
  lcd.print("====================");
  lcd.setCursor(4, 0);
  lcd.print("TEMP & HUMIDITY");
  
  // Row 1: Temperature with large display
  lcd.setCursor(0, 1);
  snprintf(buf, 21, "Temperature: %.1f C", temperature);
  lcd.print(buf);
  
  // Row 2: Humidity with large display
  lcd.setCursor(0, 2);
  snprintf(buf, 21, "Humidity: %.1f%%", humidity);
  lcd.print(buf);
  
  // Row 3: Status and threshold info
  lcd.setCursor(0, 3);
  String tempStatus = "Normal";
  if (temperature >= tempThreshold) tempStatus = "High";
  if (temperature >= tempThreshold) tempStatus = "CRITICAL";
  snprintf(buf, 21, "Status: %s", tempStatus.c_str());
  lcd.print(buf);
}

// Display Mode 2: Gas Level & Air Quality
void displayGasAQI() {
  char buf[25];
  
  // Row 0: Header
  lcd.setCursor(0, 0);
  lcd.print("====================");
  lcd.setCursor(3, 0);
  lcd.print("GAS & AIR QUALITY");
  
  // Row 1: Gas level with CO PPM
  lcd.setCursor(0, 1);
  snprintf(buf, 21, "Gas: %.1f%% CO:%.0fPPM", gasPercent, coPpm);
  lcd.print(buf);
  
  // Row 2: Air Quality Index
  lcd.setCursor(0, 2);
  snprintf(buf, 21, "Air Quality: %.0f AQI", aqi);
  lcd.print(buf);
  
  // Row 3: Status
  lcd.setCursor(0, 3);
  String gasStatus = "Normal";
  if (gasPercent >= gasThreshold * 0.8) gasStatus = "High";
  if (gasPercent >= gasThreshold) gasStatus = "DANGER";
  
  String aqiStatus = "Good";
  if (aqi > 50) aqiStatus = "Moderate";
  if (aqi > 100) aqiStatus = "Poor";
  
  snprintf(buf, 21, "Gas:%s AQI:%s", gasStatus.c_str(), aqiStatus.c_str());
  lcd.print(buf);
}

// Display Mode 3: Smoke Level Detail
void displaySmokeLevel() {
  char buf[25];
  
  // Row 0: Header
  lcd.setCursor(0, 0);
  lcd.print("====================");
  lcd.setCursor(6, 0);
  lcd.print("SMOKE LEVEL");
  
  // Row 1: Large smoke percentage
  lcd.setCursor(0, 1);
  snprintf(buf, 21, "Smoke Level: %.1f %%", smokePercent);
  lcd.print(buf);
  
  // Row 2: Threshold comparison
  lcd.setCursor(0, 2);
  snprintf(buf, 21, "Threshold:   %d %%", smokeThreshold);
  lcd.print(buf);
  
  // Row 3: Status and safety margin
  lcd.setCursor(0, 3);
  String smokeStatus = "Safe";
  if (smokePercent >= smokeThreshold * 0.7) smokeStatus = "Warning";
  if (smokePercent >= smokeThreshold) smokeStatus = "DANGER";
  
  float margin = smokeThreshold - smokePercent;
  if (margin > 0) {
    snprintf(buf, 21, "%s (%.1f%% margin)", smokeStatus.c_str(), margin);
  } else {
    snprintf(buf, 21, "%s (EXCEEDED!)", smokeStatus.c_str());
  }
  lcd.print(buf);
}

// Display Mode 4: System & WiFi Info
void displaySystemWiFi() {
  char buf[25];
  
  // Clear any potential buffer issues
  for (int i = 0; i < 25; i++) buf[i] = '\0';
  
  // Row 0: Header
  lcd.setCursor(0, 0);
  lcd.print("====================");
  lcd.setCursor(5, 0);
  lcd.print("SYSTEM INFO");
  
  // Row 1: WiFi Status and Signal
  lcd.setCursor(0, 1);
  if (WiFi.status() == WL_CONNECTED) {
    int rssi = WiFi.RSSI();
    String signal = "Weak";
    if (rssi > -50) signal = "Excellent";
    else if (rssi > -60) signal = "Good";
    else if (rssi > -70) signal = "Fair";
    
    // Clear the line first
    lcd.print("                    ");
    lcd.setCursor(0, 1);
    snprintf(buf, 21, "WiFi: %s", signal.c_str());
  } else {
    lcd.print("                    ");
    lcd.setCursor(0, 1);
    snprintf(buf, 21, "WiFi: Disconnected");
  }
  lcd.print(buf);
  
  // Row 2: Network name (truncated if needed)
  lcd.setCursor(0, 2);
  lcd.print("                    ");  // Clear line
  lcd.setCursor(0, 2);
  if (WiFi.status() == WL_CONNECTED) {
    String ssid = WiFi.SSID();
    if (ssid.length() > 17) ssid = ssid.substring(0, 14) + "...";
    snprintf(buf, 21, "Net: %s", ssid.c_str());
  } else {
    snprintf(buf, 21, "Net: Not Connected");
  }
  lcd.print(buf);
  
  // Row 3: Uptime and Memory
  lcd.setCursor(0, 3);
  lcd.print("                    ");  // Clear line
  lcd.setCursor(0, 3);
  unsigned long uptime = millis() / 1000;
  int hrs = uptime / 3600;
  int mins = (uptime % 3600) / 60;
  snprintf(buf, 21, "Up:%dh%dm Mem:%dK", hrs, mins, ESP.getFreeHeap() / 1024);
  lcd.print(buf);
}

// Critical Alarm Screen
void displayAlarmScreen() {
  char buf[25];
  static bool blink = false;
  static unsigned long lastBlink = 0;
  
  if (millis() - lastBlink > 500) {
    blink = !blink;
    lastBlink = millis();
  }
  
  // Row 0: Blinking alarm header
  lcd.setCursor(0, 0);
  if (blink) {
    lcd.print("*** FIRE ALARM! ***");
  } else {
    lcd.print("                    ");
  }
  
  // Row 1: Evacuation message
  lcd.setCursor(0, 1);
  lcd.print(">> EVACUATE NOW! <<");
  
  // Row 2: Critical readings
  lcd.setCursor(0, 2);
  if (smokePercent >= smokeThreshold) {
    snprintf(buf, 21, "SMOKE: %.1f%% HIGH!", smokePercent);
  } else if (gasPercent >= gasThreshold) {
    snprintf(buf, 21, "GAS: %.1f%% HIGH!", gasPercent);
  } else if (temperature >= tempThreshold) {
    snprintf(buf, 21, "TEMP: %.1fC HIGH!", temperature);
  } else {
    snprintf(buf, 21, "MULTIPLE SENSORS!");
  }
  lcd.print(buf);
  
  // Row 3: Action instruction
  lcd.setCursor(0, 3);
  lcd.print("Press BTN5 to SILENCE");
}

// Warning Screen for elevated readings
void displayWarningScreen() {
  char buf[25];
  static bool blink = false;
  static unsigned long lastBlink = 0;
  
  if (millis() - lastBlink > 500) {  // Faster blinking (was 1000ms)
    blink = !blink;
    lastBlink = millis();
  }
  
  // Row 0: Warning header
  lcd.setCursor(0, 0);
  if (blink) {
    lcd.print("!!! WARNING !!!");
  } else {
    lcd.print(">>> DANGER <<<");  // More urgent text
  }
  
  // Row 1: Show which sensor is elevated
  lcd.setCursor(0, 1);
  if (smokePercent >= smokeThreshold * 0.7) {
    snprintf(buf, 21, "SMOKE HIGH: %.1f%%", smokePercent);
  } else if (gasPercent >= gasThreshold * 0.7) {
    snprintf(buf, 21, "GAS HIGH: %.1f%%", gasPercent);
  } else if (temperature >= tempThreshold) {  // Use actual threshold, not 95%
    snprintf(buf, 21, "TEMP HIGH: %.1fC", temperature);
  } else if (coPpm >= coWarningThreshold * 0.8) {
    snprintf(buf, 21, "CO DETECTED: %.0f PPM", coPpm);
  } else if (aqi >= 40) {
    snprintf(buf, 21, "POOR AIR: %.0f AQI", aqi);
  } else {
    snprintf(buf, 21, "MULTIPLE SENSORS");
  }
  lcd.print(buf);
  
  // Row 2: Urgent action message
  lcd.setCursor(0, 2);
  snprintf(buf, 21, "EVACUATE AREA NOW!");
  lcd.print(buf);
  
  // Row 3: Instruction
  lcd.setCursor(0, 3);
  lcd.print("BTN5 = SILENCE ALARM");
}
