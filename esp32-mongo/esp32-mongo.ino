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
float batteryVoltage = 0;  // Battery voltage monitoring
float batteryPercent = 0;  // Battery percentage (0-100%)
bool lowBatteryDetected = false;
int gasThreshold = DEFAULT_GAS_THRESHOLD;
int tempThreshold = DEFAULT_TEMP_THRESHOLD;
bool alarmActive = false;
bool sirenEnabled = true;
bool silenceRequested = false;
bool smartAlarmMode = false;  // When true: smoke alone = WARNING only, needs temp rise for full alarm
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

// WiFi Status Tracking
bool wifiWasConnected = false;
bool wifiJustDisconnected = false;
unsigned long wifiDisconnectedTime = 0;
bool portalRunning = false;  // true when background AP portal is active
TaskHandle_t portalTaskHandle = NULL;
bool showingStartupScreen = false;

// LCD Display Mode (controlled by buttons)
int displayMode = 0;  // 0=Default, 1=Temp/Humidity, 2=Gas/AQI, 3=Smoke, 4=Carbon Monoxide, 5=System/WiFi
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
void startBackgroundPortal();
void stopBackgroundPortal();
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
  pinMode(BATTERY_PIN, INPUT);  // Battery voltage monitoring
  
  // Initialize button pins with internal pull-up resistors and stronger pull-up
  pinMode(BTN1_PIN, INPUT_PULLUP);  // Temp/Humidity
  pinMode(BTN2_PIN, INPUT_PULLUP);  // Gas Level/Air Quality
  pinMode(BTN3_PIN, INPUT_PULLUP);  // Smoke Level
  pinMode(BTN4_PIN, INPUT_PULLUP);  // Carbon Monoxide Info
  pinMode(BTN5_PIN, INPUT_PULLUP);  // System/WiFi Info
  
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
  lcd.print("  Connecting WiFi.. ");
  Serial.println("LCD 20x4 initialized");
  delay(1000);
  
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

  // Clear LCD cache after WiFi setup so default screen renders fresh
  lcd.clear();
  lcdClearCache();

  // Immediately show status dashboard — LCD works regardless of WiFi
  displayDefault();
  
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
  
  // Initialize WiFi status tracking
  wifiWasConnected = (WiFi.status() == WL_CONNECTED);
  showingStartupScreen = !wifiWasConnected;
}

void loop() {
  unsigned long now = millis();
  static unsigned long lastLCDUpdate = 0;
  
  // Check WiFi connection and handle status changes
  bool currentWiFiStatus = (WiFi.status() == WL_CONNECTED);
  
  // Detect WiFi disconnection
  if (wifiWasConnected && !currentWiFiStatus) {
    wifiJustDisconnected = true;
    wifiDisconnectedTime = millis();
    Serial.println("WiFi disconnected — starting background portal");
    displayMode = 0;
    startBackgroundPortal();  // Start portal so user can reconfigure
  }
  
  // Detect WiFi reconnection
  if (!wifiWasConnected && currentWiFiStatus) {
    Serial.println("WiFi reconnected — stopping background portal");
    wifiJustDisconnected = false;
    showingStartupScreen = false;
    stopBackgroundPortal();  // Turn off AP now that we're connected
    
    // Show brief reconnection message
    lcd.clear();
    lcd.setCursor(0, 1);
    lcd.print("  WiFi Reconnected! ");
    lcd.setCursor(0, 2);
    lcd.print("   Resuming...      ");
    delay(2000);
    lcd.clear();
  }
  
  // Update WiFi status tracking
  wifiWasConnected = currentWiFiStatus;
  
  // Handle WiFi reconnection attempts (non-blocking)
  if (!currentWiFiStatus) {
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
  // Never sound buzzer during low battery or startup warmup
  if (lowBatteryDetected || (millis() - bootTime < 20000)) {
    activateBuzzer(false);
    partialBeepState = false;
    partialBeepCount = 0;
    warningBeepState = false;
  } else if (alarmActive && sirenEnabled && !silenceRequested) {
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

void startBackgroundPortal();
void stopBackgroundPortal();

void connectWiFiManager() {
  Serial.println("FireWire startup — WiFi init...");

  const char* customCSS = "<style>"
    "* { margin:0; padding:0; box-sizing:border-box; }"
    "body { background:#f5f5f5; color:#1a1a1a; font-family:sans-serif; font-size:15px; }"
    ".wrap { max-width:400px; margin:0 auto; padding:14px 14px 32px; }"
    ".fw-header { text-align:center; padding:14px 0 10px; }"
    ".fw-logo { font-size:1.6em; font-weight:700; color:#e85d20; }"
    ".fw-tagline { color:#666; font-size:0.72em; margin-top:2px; text-transform:uppercase; }"
    ".fw-badge { display:inline-block; background:#fff3ee; border:1px solid #f0a070; color:#e85d20; font-size:0.7em; font-weight:600; padding:2px 10px; border-radius:20px; margin-top:5px; }"
    ".steps { display:flex; align-items:center; gap:4px; margin:10px 0 12px; padding:10px 12px; background:#fff; border-radius:10px; border:1px solid #e0e0e0; }"
    ".step { flex:1; text-align:center; }"
    ".step-num { width:22px; height:22px; border-radius:50%; background:#fff3ee; border:1.5px solid #e85d20; color:#e85d20; font-size:0.72em; font-weight:700; display:flex; align-items:center; justify-content:center; margin:0 auto 3px; }"
    ".step-text { color:#666; font-size:0.62em; line-height:1.2; }"
    ".step-divider { width:1px; height:24px; background:#e0e0e0; flex-shrink:0; }"
    ".card, form { background:#fff; border-radius:10px; padding:14px; margin:8px 0; border:1px solid #e0e0e0; }"
    "h1 { font-size:1.2em; font-weight:700; text-align:center; color:#1a1a1a; margin-bottom:4px; }"
    "h2, h3 { color:#555; text-align:center; font-weight:500; font-size:0.88em; margin-bottom:12px; }"
    ".c { text-align:center; margin-bottom:10px; }"
    "input[type='submit'], button, .btn { background:#e85d20; border:none; color:#fff; padding:11px 18px; border-radius:8px; cursor:pointer; font-weight:600; font-size:0.9em; width:100%; margin:5px 0 0; }"
    "input[type='submit']:active, button:active { opacity:0.85; }"
    "input[type='text'], input[type='password'], select { width:100%; background:#fafafa; border:1.5px solid #ddd; color:#1a1a1a; border-radius:8px; padding:10px 12px; font-size:0.9em; margin:4px 0 10px; font-family:inherit; }"
    "input[type='text']:focus, input[type='password']:focus { outline:none; border-color:#e85d20; }"
    "label { display:block; color:#444; font-weight:500; margin-bottom:2px; font-size:0.84em; }"
    ".q { background:#fff; border:1.5px solid #e0e0e0; border-radius:8px; margin:5px 0; padding:10px 12px; cursor:pointer; display:flex; align-items:center; justify-content:space-between; }"
    ".q:active { border-color:#e85d20; background:#fff8f5; }"
    ".l { color:#1a1a1a !important; font-weight:600; font-size:0.9em; flex:1; }"
    ".s { color:#e85d20 !important; font-weight:600; font-size:0.75em; background:#fff3ee; padding:2px 7px; border-radius:10px; border:1px solid #f0a070; white-space:nowrap; margin-left:6px; }"
    ".msg { background:#fff3ee; border:1px solid #f0a070; color:#e85d20; padding:9px 12px; border-radius:8px; margin:8px 0; font-weight:500; text-align:center; font-size:0.85em; }"
    ".error { background:#fff0f0 !important; border-color:#f0a0a0 !important; color:#c0392b !important; }"
    ".success { background:#f0fff4 !important; border-color:#a0d0a0 !important; color:#27ae60 !important; }"
    ".tip { background:#fff8f5; border-left:3px solid #e85d20; border-radius:0 7px 7px 0; padding:9px 11px; margin:10px 0 0; font-size:0.78em; color:#555; line-height:1.4; }"
    ".tip strong { color:#e85d20; }"
    "input[type='checkbox'] { margin-right:6px; accent-color:#e85d20; }"
    "hr { border:none; height:1px; background:#e0e0e0; margin:12px 0; }"
    "</style>"
    "<script>"
    "document.addEventListener('DOMContentLoaded',function(){"
      "var w=document.querySelector('.wrap');"
      "if(w){"
        "var hdr=document.createElement('div');"
        "hdr.className='fw-header';"
        "hdr.innerHTML='<div class=\"fw-logo\">&#128293; FireWire</div><div class=\"fw-tagline\">Smart Fire &amp; Gas Alarm</div><div class=\"fw-badge\">WiFi Setup</div>';"
        "w.insertBefore(hdr,w.firstChild);"
        "var steps=document.createElement('div');"
        "steps.className='steps';"
        "steps.innerHTML='<div class=\"step\"><div class=\"step-num\">1</div><div class=\"step-text\">Here</div></div><div class=\"step-divider\"></div><div class=\"step\"><div class=\"step-num\">2</div><div class=\"step-text\">Pick WiFi</div></div><div class=\"step-divider\"></div><div class=\"step\"><div class=\"step-num\">3</div><div class=\"step-text\">Password</div></div><div class=\"step-divider\"></div><div class=\"step\"><div class=\"step-num\">4</div><div class=\"step-text\">Done</div></div>';"
        "w.insertBefore(steps,w.children[1]);"
      "}"
      "var forms=document.querySelectorAll('form');"
      "if(forms.length>0){"
        "var tip=document.createElement('div');"
        "tip.className='tip';"
        "tip.innerHTML='<strong>Tip:</strong> Use your home WiFi - not a mobile hotspot.';"
        "forms[0].appendChild(tip);"
      "}"
    "});"
    "</script>";

  wifiManager.setCustomHeadElement(customCSS);
  wifiManager.setAPStaticIPConfig(IPAddress(192,168,4,1), IPAddress(192,168,4,1), IPAddress(255,255,255,0));
  wifiManager.setConnectTimeout(15);
  wifiManager.setConfigPortalTimeout(0);

  // Check if we have saved credentials
  WiFi.mode(WIFI_STA);
  delay(100);
  String savedSSID = WiFi.SSID();
  Serial.printf("Saved SSID: '%s'\n", savedSSID.c_str());

  if (savedSSID.length() > 0) {
    // Try saved credentials — but check Button 5 during wait so user can skip to offline
    Serial.printf("Trying saved WiFi: %s\n", savedSSID.c_str());
    WiFi.begin();

    lcd.clear();
    lcdClearCache();
    lcdWriteLine(0, "====  FireWire  ====");
    lcdWriteLine(1, "Connecting to WiFi..");
    lcdWriteLine(2, "Hold BTN5 to skip   ");
    lcdWriteLine(3, "                    ");

    unsigned long startAttempt = millis();
    bool skipped = false;
    unsigned long btn5HoldStart = 0;

    while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 15000) {
      // Update countdown on LCD
      unsigned long remaining = (15000 - (millis() - startAttempt)) / 1000;
      char buf[21];
      snprintf(buf, 21, "Timeout in %lus...   ", remaining);
      lcdWriteLine(3, buf);

      // Check Button 5 for skip (long press 2s)
      if (digitalRead(BTN5_PIN) == LOW) {
        if (btn5HoldStart == 0) btn5HoldStart = millis();
        if (millis() - btn5HoldStart >= 2000) {
          skipped = true;
          Serial.println("BTN5 held — skipping to offline mode");
          break;
        }
      } else {
        btn5HoldStart = 0;
      }
      delay(200);
    }

    if (skipped) {
      WiFi.disconnect();
      lcd.clear();
      lcdClearCache();
      lcdWriteLine(0, "====  FireWire  ====");
      lcdWriteLine(1, "Offline Mode        ");
      lcdWriteLine(2, "WiFi skipped by user");
      lcdWriteLine(3, "Sensors active      ");
      delay(2000);
      portalRunning = false;
      return;
    }
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("WiFi connected! SSID: %s IP: %s\n", WiFi.SSID().c_str(), WiFi.localIP().toString().c_str());
    portalRunning = false;
    digitalWrite(LED_PIN, HIGH);
    delay(500);
    digitalWrite(LED_PIN, LOW);
  } else if (savedSSID.length() == 0) {
    // No saved credentials — must open portal (first time setup)
    // This is blocking but only happens on first setup
    Serial.println("No saved WiFi — opening setup portal (blocking)");
    lcd.clear();
    lcdClearCache();
    lcdWriteLine(0, "====  FireWire  ====");
    lcdWriteLine(1, "WiFi Setup Required ");
    lcdWriteLine(2, "Connect to:         ");
    lcdWriteLine(3, "  FireWire-Setup    ");
    bool connected = wifiManager.autoConnect(WIFI_AP_NAME, WIFI_AP_PASSWORD);
    if (connected) {
      Serial.printf("WiFi configured! IP: %s\n", WiFi.localIP().toString().c_str());
    }
    portalRunning = false;
  } else {
    // Had credentials but couldn't connect — go offline, start background portal
    Serial.println("WiFi unavailable — offline mode + background portal");
    portalRunning = false;
    startBackgroundPortal();
  }
}

// Background portal — opens FireWire-Setup hotspot for WiFi reconfiguration
// Called when WiFi disconnects mid-operation
void startBackgroundPortal() {
  if (portalRunning) return;
  Serial.println("Starting background WiFi portal...");

  // Run portal in a FreeRTOS task on Core 0 so main loop keeps running
  portalRunning = true;
  xTaskCreatePinnedToCore(
    [](void* param) {
      wifiManager.setConnectTimeout(15);
      wifiManager.setConfigPortalTimeout(0);
      bool ok = wifiManager.startConfigPortal(WIFI_AP_NAME, WIFI_AP_PASSWORD);
      Serial.printf("[Portal] %s\n", ok ? "Connected!" : "Closed without connecting");
      portalRunning = false;
      vTaskDelete(NULL);
    },
    "PortalTask", 8192, NULL, 1, &portalTaskHandle, 0
  );
}

// Stop background portal
void stopBackgroundPortal() {
  if (!portalRunning) return;
  if (portalTaskHandle != NULL) {
    vTaskDelete(portalTaskHandle);
    portalTaskHandle = NULL;
  }
  wifiManager.stopConfigPortal();
  WiFi.softAPdisconnect(true);
  portalRunning = false;
  Serial.println("Background portal stopped");
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
    Serial.println("\nWiFi connection failed — continuing in offline mode");
    // Don't restart — let the loop handle reconnection
  }
}

void connectWiFi() {
  // Non-blocking reconnection — just kick off reconnect and return immediately
  // The loop() will check WiFi status on next iteration
  if (WiFi.status() == WL_CONNECTED) return;

  static unsigned long lastReconnectAttempt = 0;
  unsigned long now = millis();

  // Only attempt reconnect every 10 seconds to avoid hammering
  if (now - lastReconnectAttempt < 10000) return;
  lastReconnectAttempt = now;

  Serial.println("WiFi disconnected — attempting reconnect (non-blocking)");
  WiFi.reconnect();
  // Don't block — loop() continues, LCD keeps updating
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
  
  // Read voltage and battery monitoring
  voltage = 3.3;
  
  // Read battery voltage (GPIO 35)
  // Note: This depends on your battery shield's voltage output to ESP32
  int batteryRaw = analogRead(BATTERY_PIN);
  float rawVoltage = (batteryRaw / 4095.0) * 3.3;  // Convert ADC to voltage
  
  // Battery shield voltage interpretation (adjust based on your shield)
  // Most shields provide a scaled-down voltage to ESP32 for monitoring
  if (rawVoltage > 0.1) {  // Valid reading
    // Common scaling: 3.3V ADC represents full battery voltage
    // Adjust this multiplier based on your battery shield specs
    batteryVoltage = rawVoltage * 2.5;  // Estimated scaling factor
    
    // Calculate battery percentage (for 2S Li-ion: 6.0V-8.4V range)
    float minVoltage = 6.0;   // 3.0V per cell (empty)
    float maxVoltage = 8.4;   // 4.2V per cell (full)
    batteryPercent = ((batteryVoltage - minVoltage) / (maxVoltage - minVoltage)) * 100.0;
    batteryPercent = constrain(batteryPercent, 0, 100);  // Keep within 0-100%
    
    // Check for low battery condition
    if (batteryVoltage < CRITICAL_BATTERY_VOLTAGE && batteryVoltage > 1.0) {
      lowBatteryDetected = true;
      Serial.printf("CRITICAL LOW BATTERY: %.2fV (%.0f%%) - Disabling alarms\n", batteryVoltage, batteryPercent);
    } else if (batteryVoltage < LOW_BATTERY_VOLTAGE && batteryVoltage > 1.0) {
      Serial.printf("LOW BATTERY WARNING: %.2fV (%.0f%%)\n", batteryVoltage, batteryPercent);
    } else if (batteryVoltage > LOW_BATTERY_VOLTAGE) {
      lowBatteryDetected = false;  // Reset when battery is good
    }
    
    // Debug output every 10 seconds
    static unsigned long lastBatteryDebug = 0;
    if (millis() - lastBatteryDebug > 10000) {
      Serial.printf("Battery Monitor: Raw ADC=%d, Raw V=%.2f, Scaled V=%.2f, Percent=%.0f%%\n", 
                    batteryRaw, rawVoltage, batteryVoltage, batteryPercent);
      lastBatteryDebug = millis();
    }
  } else {
    // No valid battery reading (probably on external power)
    batteryVoltage = 0;
    batteryPercent = 0;
    lowBatteryDetected = false;
  }
  
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
  
  // Display normalization: Show 0% if below 3% baseline for better UX
  // (Real value still used for thresholds and data storage)
  float smokePercentDisplay = (smokePercent < 3.0) ? 0.0 : smokePercent;
  
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
  if (rawADC <= 0 || ro <= 0) return 0;  // Return actual 0 for no reading
  
  float voltage = (rawADC / 4095.0) * 3.3;
  if (voltage <= 0.01) return 0;  // Return 0 for very low voltage
  
  float rs = ((3.3 * LOAD_RESISTANCE) / voltage) - LOAD_RESISTANCE;
  if (rs <= 0) return 0;  // Return 0 for invalid resistance
  
  float ratio = rs / ro;
  
  // More sensitive CO calculation - allow true zero readings
  float ppm;
  
  if (rawADC < 20) {
    // Very low ADC = clean air (0-1 PPM)
    ppm = (rawADC / 20.0);  // 0-1 PPM range
  } else if (rawADC < 100) {
    // Low ADC range = normal indoor CO (1-5 PPM)
    ppm = 1 + ((rawADC - 20) / 80.0) * 4.0;  // 1-5 PPM range
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
  
  // Allow true zero readings, cap maximum only
  if (ppm < 0) ppm = 0;  // Don't allow negative
  if (ppm > 200) ppm = 200;  // Cap at dangerous levels
  
  return round(ppm * 10) / 10.0;  // Round to 1 decimal place
}

float calculateAQI(int rawADC, float ro) {
  if (rawADC <= 0 || ro <= 0) return 0;  // Return actual 0 for no reading
  
  float voltage = (rawADC / 4095.0) * 3.3;
  if (voltage <= 0.01) return 0;  // Return 0 for very low voltage
  
  float rs = ((3.3 * LOAD_RESISTANCE) / voltage) - LOAD_RESISTANCE;
  if (rs <= 0) return 0;  // Return 0 for invalid resistance
  
  float ratio = rs / ro;
  
  // More sensitive AQI calculation - allow true zero readings
  float aqiValue;
  
  if (rawADC < 30) {
    // Very low ADC = excellent air (0-5 AQI)
    aqiValue = (rawADC / 30.0) * 5.0;  // 0-5 AQI range
  } else if (rawADC < 100) {
    // Low ADC range = good air (5-20 AQI)
    aqiValue = 5 + ((rawADC - 30) / 70.0) * 15.0;
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
  
  // Allow true zero readings, cap maximum only
  if (aqiValue < 0) return 0;  // Don't allow negative
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
  // STARTUP WARMUP — ignore all sensor readings for first 20 seconds
  // MQ sensors output unstable high values on power-on before settling
  if (millis() - bootTime < 20000) {
    alarmActive = false;
    partialWarningActive = false;
    warningMode = false;
    return;
  }

  // LOW BATTERY PROTECTION - Disable alarms during low battery to prevent false triggers
  if (lowBatteryDetected) {
    alarmActive = false;
    partialWarningActive = false;
    Serial.println("ALARM DISABLED: Low battery detected - preventing false alarms");
    return;
  }
  
  // Gas alarm when MQ-7 reading exceeds gas threshold
  bool gasAlarm = gasPercent >= gasThreshold;
  
  // Temperature alarm when temp exceeds threshold
  bool tempAlarm = tempSensorReady && temperature >= tempThreshold && temperature < 100.0;
  
  // Smart smoke detection logic
  bool smokeDetected = smokePercent >= smokeThreshold;
  bool gasDetected = gasPercent >= gasThreshold;
  bool tempRiseDetected = tempBaselineReady && (temperature > baselineTemp + 5.0);  // Increased from 3°C to 5°C to be less sensitive
  
  // Full alarm conditions depend on smartAlarmMode setting
  bool smokeAlarm, gasAlarmWithTemp;
  if (smartAlarmMode) {
    // SMART MODE: smoke/gas alone = warning only, needs temp rise for full alarm
    smokeAlarm = smokeDetected && tempRiseDetected;
    gasAlarmWithTemp = gasDetected && tempRiseDetected;
  } else {
    // SENSITIVE MODE (default): smoke/gas alone = full alarm immediately
    smokeAlarm = smokeDetected;
    gasAlarmWithTemp = gasDetected;
  }
  
  // Partial warning conditions (smoke/gas detected regardless of small temp changes)
  bool smokeWarningOnly = smokeDetected && !tempAlarm;  // Changed: ignore small temp rise, only check temp threshold
  bool gasWarningOnly = gasDetected && !tempAlarm;      // Changed: ignore small temp rise, only check temp threshold
  
  // Combined states
  bool wasAlarm = alarmActive;
  bool wasPartialWarning = partialWarningActive;

  // Determine raw trigger conditions
  bool rawAlarm = tempAlarm || smokeAlarm || gasAlarmWithTemp;
  bool rawPartial = (smokeWarningOnly || gasWarningOnly) && !rawAlarm;

  // CLEAR DELAY: once triggered, require 5 consecutive seconds of safe readings before clearing
  // This prevents the alarm from flickering off/on as sensor recovers
  static unsigned long alarmClearStart = 0;
  static unsigned long partialClearStart = 0;

  if (rawAlarm) {
    alarmActive = true;
    alarmClearStart = 0;  // Reset clear timer
  } else if (alarmActive) {
    // Was alarming, now readings are safe — start clear countdown
    if (alarmClearStart == 0) alarmClearStart = millis();
    if (millis() - alarmClearStart >= 5000) {
      alarmActive = false;  // 5 seconds of safe readings — clear alarm
      alarmClearStart = 0;
    }
    // else: keep alarm active while waiting for sustained safe readings
  }

  if (rawPartial && !alarmActive) {
    partialWarningActive = true;
    partialClearStart = 0;
  } else if (partialWarningActive) {
    if (partialClearStart == 0) partialClearStart = millis();
    if (millis() - partialClearStart >= 3000) {
      partialWarningActive = false;
      partialClearStart = 0;
    }
  } else {
    partialWarningActive = false;
  }
  
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
  
  // AUTO-SILENCE: if alarm has been active for 30 seconds with no user acknowledgement,
  // silence the buzzer automatically (alarm state stays active on LCD)
  static unsigned long alarmStartTime = 0;
  if (alarmActive && !silenceRequested) {
    if (alarmStartTime == 0) alarmStartTime = millis();
    if (millis() - alarmStartTime > 30000) {
      silenceRequested = true;
      Serial.println("AUTO-SILENCE: Alarm active 30s with no acknowledgement");
    }
  } else if (!alarmActive) {
    alarmStartTime = 0;
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
  doc["batteryVoltage"] = batteryVoltage;
  doc["batteryPercent"] = batteryPercent;
  doc["lowBattery"] = lowBatteryDetected;
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
  doc["smoke"] = smokePercent;  // Real value for thresholds/storage
  float displayValue = (smokePercent < 3.0) ? 0.0 : smokePercent;
  doc["smokeDisplay"] = displayValue;  // Display value for UI - ensure float type
  doc["smokeRaw"] = smokeRaw;
  doc["smokeStatus"] = smokeStatus;
  
  // Debug output for troubleshooting
  Serial.printf("Smoke Debug - Real: %.1f%%, Display: %.1f%%, JSON Check: %.1f%%\n", 
                smokePercent, displayValue, doc["smokeDisplay"].as<float>());
  
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
  
  // Debug: Print JSON payload to see what's actually being sent
  Serial.println("JSON Payload:");
  Serial.println(payload);
  
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
      
      if (doc.containsKey("smartAlarmMode")) {
        smartAlarmMode = doc["smartAlarmMode"].as<bool>();
        Serial.printf("Smart alarm mode updated: %s\n", smartAlarmMode ? "ON (smart)" : "OFF (sensitive)");
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
  bool btn4 = (digitalRead(BTN4_PIN) == LOW);  // Carbon Monoxide Info
  bool btn5 = (digitalRead(BTN5_PIN) == LOW);  // WiFi Toggle

  // Debug button states
  static unsigned long lastDebug = 0;
  if (now - lastDebug > 1000) {
    if (btn1 || btn2 || btn3 || btn4 || btn5) {
      Serial.printf("Button states: BTN1=%d BTN2=%d BTN3=%d BTN4=%d BTN5=%d\n",
                    btn1, btn2, btn3, btn4, btn5);
    }
    lastDebug = now;
  }

  // Button 5 — WiFi toggle (long press 2s)
  // Online: disconnects WiFi, goes offline
  // Offline: tries to reconnect to saved WiFi
  static unsigned long btn5HoldStart = 0;
  if (btn5) {
    if (btn5HoldStart == 0) btn5HoldStart = now;
    if (now - btn5HoldStart >= 2000) {
      btn5HoldStart = 0;
      lastButtonPress = now;
      bool wifiOk = (WiFi.status() == WL_CONNECTED);
      if (wifiOk) {
        // Go offline
        Serial.println("BTN5: Disconnecting WiFi → offline mode");
        WiFi.disconnect();
        if (portalRunning && portalTaskHandle != NULL) {
          vTaskDelete(portalTaskHandle);
          portalTaskHandle = NULL;
          portalRunning = false;
        }
        lcd.clear();
        lcdClearCache();
        lcdWriteLine(0, "====  FireWire  ====");
        lcdWriteLine(1, "WiFi Disconnected   ");
        lcdWriteLine(2, "Running offline...  ");
        lcdWriteLine(3, "Hold BTN5 to rejoin ");
        delay(2000);
        displayMode = 0;
      } else {
        // Try to reconnect
        Serial.println("BTN5: Attempting WiFi reconnect...");
        lcd.clear();
        lcdClearCache();
        lcdWriteLine(0, "====  FireWire  ====");
        lcdWriteLine(1, "Reconnecting WiFi...");
        lcdWriteLine(2, "Please wait...      ");
        lcdWriteLine(3, "                    ");
        WiFi.begin();
        unsigned long start = millis();
        while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
          delay(300);
        }
        if (WiFi.status() == WL_CONNECTED) {
          lcdWriteLine(1, "WiFi Connected!     ");
          lcdWriteLine(2, WiFi.SSID().c_str());
          delay(2000);
        } else {
          lcdWriteLine(1, "Could not connect   ");
          lcdWriteLine(2, "Still offline       ");
          delay(2000);
        }
        lcd.clear();
        lcdClearCache();
        displayMode = 0;
      }
      return;
    }
  } else {
    btn5HoldStart = 0;
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
  // Button 4 - Carbon Monoxide Info
  else if (btn4) {
    newMode = 4;
    Serial.println("BTN4 pressed - Carbon Monoxide mode");
  }
  
  // If mode changed, start slide animation
  if (newMode != displayMode && (btn1 || btn2 || btn3 || btn4 || btn5)) {
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
  lcdClearCache();
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
  // Use 90% of threshold to avoid false warnings from ambient readings
  bool gasHigh = gasPercent >= gasThreshold * 0.9;
  bool smokeHigh = smokePercent >= smokeThreshold * 0.9;
  bool tempHigh = temperature >= tempThreshold;
  bool coHigh = coPpm >= coWarningThreshold * 0.9;
  bool aqiPoor = aqi >= 100;  // Only warn at Unhealthy for Sensitive Groups (was 40)
  
  return gasHigh || smokeHigh || tempHigh || coHigh || aqiPoor || alarmActive;
}

// Update LCD display with sensor readings (20x4 LCD)
void updateLCD() {
  char buf[25];
  
  // Priority 1: Low Battery Warning (highest priority)
  if (lowBatteryDetected) {
    displayLowBattery();
    return;
  }
  
  // Priority 2: Critical alarm — always show regardless of WiFi
  if (alarmActive) {
    displayAlarmScreen();
    return;
  }

  // Priority 3: Warning state — always show regardless of WiFi
  bool startupPeriod = millis() < 15000;
  bool shouldShowWarning = !startupPeriod && checkWarningState();
  if (shouldShowWarning && !warningMode) {
    warningMode = true;
    lcd.clear();
    lcdClearCache();
  } else if (!shouldShowWarning && warningMode) {
    warningMode = false;
    lcd.clear();
    lcdClearCache();
  }
  if (warningMode && !startupPeriod) {
    displayWarningScreen();
    return;
  }
  
  // Show animation if active
  if (isAnimating) {
    updateAnimation();
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
    case 4:  // Carbon Monoxide Info
      displayCO();
      break;
    case 5:  // System/WiFi Info
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

// Helper function to get display-normalized smoke percentage
float getSmokePercentDisplay() {
  return (smokePercent < 3.0) ? 0.0 : smokePercent;
}

// LCD line cache — only write when content changes to prevent flicker
static char lcdCache[4][21] = {"","","",""};

void lcdWriteLine(int row, const char* text) {
  // Pad to exactly 20 chars
  char padded[21];
  snprintf(padded, 21, "%-20s", text);
  padded[20] = '\0';
  // Only write if changed
  if (strncmp(lcdCache[row], padded, 20) != 0) {
    lcd.setCursor(0, row);
    lcd.print(padded);
    strncpy(lcdCache[row], padded, 20);
  }
}

void lcdClearCache() {
  for (int i = 0; i < 4; i++) lcdCache[i][0] = '\0';
}

// Display Mode 0: Status Dashboard
void displayDefault() {
  char buf[21];
  bool wifiOk = (WiFi.status() == WL_CONNECTED);
  bool warming = (millis() - bootTime < 20000);

  // Row 0: Branding (static — only writes once)
  lcdWriteLine(0, "====  FireWire  ====");

  // Row 1: Overall home status
  if (warming) {
    lcdWriteLine(1, "Sensors warming up..");
  } else if (alarmActive) {
    lcdWriteLine(1, "!! FIRE ALARM !!    ");
  } else if (partialWarningActive || warningMode) {
    lcdWriteLine(1, "!! CAUTION !!       ");
  } else {
    lcdWriteLine(1, "Status: HOME IS SAFE");
  }

  // Row 2: Alarm mode / countdown
  if (warming) {
    unsigned long remaining = (20000 - (millis() - bootTime)) / 1000 + 1;
    snprintf(buf, 21, "Ready in %lus...     ", remaining);
    lcdWriteLine(2, buf);
  } else if (smartAlarmMode) {
    lcdWriteLine(2, "Mode: Smart Alarm   ");
  } else {
    lcdWriteLine(2, "Mode: Full Alarm    ");
  }

  // Row 3: WiFi status
  if (wifiOk) {
    lcdWriteLine(3, "WiFi: Online        ");
  } else if (wifiJustDisconnected) {
    lcdWriteLine(3, "WiFi: Reconnecting..");
  } else {
    lcdWriteLine(3, "WiFi: Offline       ");
  }
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
  
  // Row 3: Status (shortened to fit 20 chars)
  lcd.setCursor(0, 3);
  lcd.print("                    ");  // Clear line first
  lcd.setCursor(0, 3);
  String gasStatus = "OK";  // Shortened from "Normal"
  if (gasPercent >= gasThreshold * 0.8) gasStatus = "High";
  if (gasPercent >= gasThreshold) gasStatus = "DANGER";
  
  String aqiStatus = "Good";
  if (aqi > 50) aqiStatus = "Mod";  // Shortened "Moderate" to "Mod"
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
  
  // Row 1: Large smoke percentage (using display value)
  lcd.setCursor(0, 1);
  snprintf(buf, 21, "Smoke Level: %.1f %%", getSmokePercentDisplay());
  lcd.print(buf);
  
  // Row 2: Threshold comparison
  lcd.setCursor(0, 2);
  snprintf(buf, 21, "Threshold:   %d %%", smokeThreshold);
  lcd.print(buf);
  
  // Row 3: Status and safety margin (using real value for calculations)
  lcd.setCursor(0, 3);
  String smokeStatus = "Safe";
  if (smokePercent >= smokeThreshold * 0.9) smokeStatus = "Warning";
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
  
  // Row 3: Smart Alarm Mode status
  lcd.setCursor(0, 3);
  lcd.print("                    ");  // Clear line
  lcd.setCursor(0, 3);
  if (smartAlarmMode) {
    snprintf(buf, 21, "Mode: Smart Alarm");
  } else {
    snprintf(buf, 21, "Mode: Full Alarm");
  }
  lcd.print(buf);
}

// Display Mode 5: Carbon Monoxide Detail
void displayCO() {
  char buf[25];
  
  // Row 0: Header
  lcd.setCursor(0, 0);
  lcd.print("====================");
  lcd.setCursor(4, 0);
  lcd.print("CARBON MONOXIDE");
  
  // Row 1: CO Level in PPM
  lcd.setCursor(0, 1);
  snprintf(buf, 21, "CO Level: %.1f PPM", coPpm);
  lcd.print(buf);
  
  // Row 2: CO Status and Raw ADC
  lcd.setCursor(0, 2);
  lcd.print("                    ");  // Clear line first
  lcd.setCursor(0, 2);
  snprintf(buf, 21, "Status: %s (%d)", coStatus.c_str(), coRaw);
  lcd.print(buf);
  
  // Row 3: Safety thresholds info
  lcd.setCursor(0, 3);
  lcd.print("                    ");  // Clear line first
  lcd.setCursor(0, 3);
  if (coPpm < 9) {
    snprintf(buf, 21, "Safe: <9PPM Normal");
  } else if (coPpm < 35) {
    snprintf(buf, 21, "Caution: 9-35PPM");
  } else if (coPpm < 200) {
    snprintf(buf, 21, "Warning: 35-200PPM");
  } else {
    snprintf(buf, 21, "DANGER: >200PPM!");
  }
  lcd.print(buf);
}

// Low Battery Warning Screen
void displayLowBattery() {
  char buf[25];
  static bool blink = false;
  static unsigned long lastBlink = 0;
  
  // Blink effect every 1 second
  if (millis() - lastBlink > 1000) {
    blink = !blink;
    lastBlink = millis();
  }
  
  // Row 0: Header with warning
  lcd.setCursor(0, 0);
  if (blink) {
    lcd.print("!!! LOW BATTERY !!!");
  } else {
    lcd.print("====================");
  }
  
  // Row 1: Battery voltage and percentage
  lcd.setCursor(0, 1);
  if (batteryPercent > 0) {
    snprintf(buf, 21, "%.2fV (%.0f%%) ", batteryVoltage, batteryPercent);
  } else {
    snprintf(buf, 21, "%.2fV (Unknown%%) ", batteryVoltage);
  }
  lcd.print(buf);
  
  // Row 2: Status message
  lcd.setCursor(0, 2);
  if (batteryVoltage < CRITICAL_BATTERY_VOLTAGE) {
    lcd.print("CRITICAL - CHARGE NOW");
  } else {
    lcd.print("LOW - Please Charge ");
  }
  
  // Row 3: Alarm status
  lcd.setCursor(0, 3);
  lcd.print("Alarms Disabled     ");
}

// WiFi Disconnected Screen
void displayWiFiDisconnected() {
  char buf[25];
  static bool blink = false;
  static unsigned long lastBlink = 0;
  
  // Blink effect every 1 second
  if (millis() - lastBlink > 1000) {
    blink = !blink;
    lastBlink = millis();
  }
  
  // Row 0: Header with warning
  lcd.setCursor(0, 0);
  if (blink) {
    lcd.print("!!!! WiFi LOST !!!!");
  } else {
    lcd.print("====================");
  }
  
  // Row 1: Connection status
  lcd.setCursor(0, 1);
  lcd.print("  NO WIFI CONNECTION");
  
  // Row 2: Attempting to reconnect
  lcd.setCursor(0, 2);
  unsigned long disconnectedSeconds = (millis() - wifiDisconnectedTime) / 1000;
  snprintf(buf, 21, "Reconnecting... %lus", disconnectedSeconds);
  lcd.print(buf);
  
  // Row 3: Instruction
  lcd.setCursor(0, 3);
  lcd.print("Check WiFi Settings ");
}

// WiFi Startup/Connecting Screen
void displayWiFiStartup() {
  char buf[25];
  static int dots = 0;
  static unsigned long lastDot = 0;
  
  // Animate dots every 500ms
  if (millis() - lastDot > 500) {
    dots = (dots + 1) % 4;
    lastDot = millis();
  }
  
  // Row 0: Header
  lcd.setCursor(0, 0);
  lcd.print("====================");
  lcd.setCursor(6, 0);
  lcd.print("FireWire");
  
  // Row 1: Status
  lcd.setCursor(0, 1);
  lcd.print("  Connecting to WiFi");
  
  // Row 2: Animated dots
  lcd.setCursor(0, 2);
  lcd.print("      Please wait");
  for (int i = 0; i < dots; i++) {
    lcd.print(".");
  }
  for (int i = dots; i < 3; i++) {
    lcd.print(" ");
  }
  
  // Row 3: Instruction
  lcd.setCursor(0, 3);
  lcd.print("Hold BOOT to reset  ");
}

// Critical Alarm Screen
void displayAlarmScreen() {
  static bool blink = false;
  static unsigned long lastBlink = 0;
  char buf[21];

  if (millis() - lastBlink > 500) {
    blink = !blink;
    lastBlink = millis();
    lcdClearCache();  // Force redraw on blink
  }

  // Row 0: Blinking alarm header (exactly 20 chars)
  if (blink) {
    lcdWriteLine(0, "** FIRE ALARM!!! **");
  } else {
    lcdWriteLine(0, "====================");
  }

  // Row 1: Evacuation message (exactly 20 chars)
  lcdWriteLine(1, ">> EVACUATE NOW! << ");

  // Row 2: Which sensor triggered (exactly 20 chars)
  if (smokePercent >= smokeThreshold) {
    snprintf(buf, 21, "SMOKE:%.1f%% DANGER! ", getSmokePercentDisplay());
  } else if (gasPercent >= gasThreshold) {
    snprintf(buf, 21, "GAS:%.1f%% DANGER!   ", gasPercent);
  } else if (temperature >= tempThreshold) {
    snprintf(buf, 21, "TEMP:%.1fC DANGER!  ", temperature);
  } else {
    lcdWriteLine(2, "MULTIPLE SENSORS!   ");
    buf[0] = '\0';
  }
  if (buf[0] != '\0') lcdWriteLine(2, buf);

  // Row 3: Action (exactly 20 chars)
  lcdWriteLine(3, "  EVACUATE AREA!    ");
}

// Warning Screen for elevated readings
void displayWarningScreen() {
  char buf[21];
  static bool blink = false;
  static unsigned long lastBlink = 0;

  if (millis() - lastBlink > 600) {
    blink = !blink;
    lastBlink = millis();
    lcdClearCache();
  }

  // Row 0: Warning header (exactly 20 chars)
  if (blink) {
    lcdWriteLine(0, "!!!!  WARNING  !!!!");
  } else {
    lcdWriteLine(0, "====================");
  }

  // Row 1: Which sensor is elevated (exactly 20 chars)
  if (smokePercent >= smokeThreshold * 0.9) {
    snprintf(buf, 21, "SMOKE HIGH:%.1f%%    ", getSmokePercentDisplay());
  } else if (gasPercent >= gasThreshold * 0.9) {
    snprintf(buf, 21, "GAS HIGH:%.1f%%      ", gasPercent);
  } else if (temperature >= tempThreshold) {
    snprintf(buf, 21, "TEMP HIGH:%.1fC     ", temperature);
  } else if (coPpm >= coWarningThreshold * 0.9) {
    snprintf(buf, 21, "CO DETECTED:%.0fPPM ", coPpm);
  } else if (aqi > 100) {
    snprintf(buf, 21, "POOR AIR:%.0f AQI   ", aqi);
  } else {
    lcdWriteLine(1, "MULTIPLE SENSORS!   ");
    buf[0] = '\0';
  }
  if (buf[0] != '\0') lcdWriteLine(1, buf);

  // Row 2: Action
  lcdWriteLine(2, "Check your home now ");

  // Row 3: Silence instruction
  lcdWriteLine(3, "App: Stop the Alarm ");
}
