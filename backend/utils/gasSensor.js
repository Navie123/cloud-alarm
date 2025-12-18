/**
 * Gas Sensor Utility Functions
 * Shared functions for MQ-7 (CO) and MQ-135 (Air Quality) sensor calculations
 * 
 * These pure functions handle PPM/AQI calculations and status classification
 * for use in both backend processing and testing.
 */

// MQ-7 sensor characteristics (from datasheet)
// Rs/Ro ratio vs PPM curve approximation: {x, y, slope}
const MQ7_CURVE = { x: 2.3, y: 0.72, slope: -0.34 };

// Default thresholds for CO (PPM)
const CO_THRESHOLDS = {
  WARNING: 35,
  DANGER: 100,
  CRITICAL: 400
};

// AQI level boundaries
const AQI_LEVELS = {
  GOOD: 50,
  MODERATE: 100,
  UNHEALTHY_SENSITIVE: 150
};

/**
 * Calculate CO PPM from raw ADC value using MQ-7 sensor characteristics
 * @param {number} rawADC - Raw ADC reading (0-4095 for ESP32 12-bit ADC)
 * @param {number} ro - Sensor resistance in clean air (calibration value)
 * @param {number} loadResistance - Load resistor value in kOhms (default 10)
 * @param {number} vRef - Reference voltage (default 3.3V for ESP32)
 * @returns {number} CO concentration in PPM (0-1000)
 */
function calculateCOPpm(rawADC, ro, loadResistance = 10, vRef = 3.3) {
  // Validate inputs
  if (rawADC < 0 || rawADC > 4095) {
    return 0;
  }
  if (ro <= 0) {
    return 0;
  }

  // Convert ADC to voltage
  const voltage = (rawADC / 4095) * vRef;
  
  // Avoid division by zero
  if (voltage <= 0) {
    return 0;
  }

  // Calculate sensor resistance Rs
  // Rs = ((Vref * RL) / Vout) - RL
  const rs = ((vRef * loadResistance) / voltage) - loadResistance;
  
  if (rs <= 0) {
    return 1000; // Max reading if Rs is invalid (saturated sensor)
  }

  // Calculate Rs/Ro ratio
  const ratio = rs / ro;

  // PPM = 10 ^ ((log10(ratio) - y) / slope + x)
  // Using MQ-7 characteristic curve
  const ppm = Math.pow(10, ((Math.log10(ratio) - MQ7_CURVE.y) / MQ7_CURVE.slope) + MQ7_CURVE.x);

  // Constrain to valid range
  return Math.max(0, Math.min(1000, ppm));
}

/**
 * Get CO status classification based on PPM value
 * @param {number} ppm - CO concentration in PPM
 * @param {object} thresholds - Custom thresholds (optional)
 * @returns {string} Status: 'normal', 'warning', 'danger', or 'critical'
 */
function getCOStatus(ppm, thresholds = CO_THRESHOLDS) {
  if (ppm >= thresholds.CRITICAL) {
    return 'critical';
  }
  if (ppm >= thresholds.DANGER) {
    return 'danger';
  }
  if (ppm >= thresholds.WARNING) {
    return 'warning';
  }
  return 'normal';
}

/**
 * Calculate Air Quality Index from raw MQ-135 ADC value
 * Maps sensor ratio to 0-500 AQI scale
 * @param {number} rawADC - Raw ADC reading (0-4095)
 * @param {number} ro - Sensor resistance in clean air (calibration value)
 * @param {number} loadResistance - Load resistor value in kOhms (default 10)
 * @param {number} vRef - Reference voltage (default 3.3V)
 * @returns {number} Air Quality Index (0-500)
 */
function calculateAQI(rawADC, ro, loadResistance = 10, vRef = 3.3) {
  // Validate inputs
  if (rawADC < 0 || rawADC > 4095) {
    return 0;
  }
  if (ro <= 0) {
    return 0;
  }

  // Convert ADC to voltage
  const voltage = (rawADC / 4095) * vRef;
  
  if (voltage <= 0) {
    return 0;
  }

  // Calculate sensor resistance Rs
  const rs = ((vRef * loadResistance) / voltage) - loadResistance;
  
  if (rs <= 0) {
    return 500; // Max AQI if sensor saturated
  }

  // Calculate Rs/Ro ratio
  const ratio = rs / ro;

  // Map ratio to AQI
  // Clean air: ratio ~1.0 -> AQI ~0
  // Polluted air: ratio ~0.2 -> AQI ~500
  // Linear mapping: AQI = (1 - ratio) * 625, clamped to 0-500
  const aqi = Math.round((1 - Math.min(ratio, 1)) * 625);

  // Constrain to valid range
  return Math.max(0, Math.min(500, aqi));
}

/**
 * Get AQI status classification based on AQI value
 * @param {number} aqi - Air Quality Index (0-500)
 * @returns {string} Status: 'good', 'moderate', 'unhealthy_sensitive', or 'unhealthy'
 */
function getAQIStatus(aqi) {
  if (aqi <= AQI_LEVELS.GOOD) {
    return 'good';
  }
  if (aqi <= AQI_LEVELS.MODERATE) {
    return 'moderate';
  }
  if (aqi <= AQI_LEVELS.UNHEALTHY_SENSITIVE) {
    return 'unhealthy_sensitive';
  }
  return 'unhealthy';
}

/**
 * Detect fire risk based on multiple sensor readings
 * Fire risk is triggered when CO, temperature, AND gas/smoke are all elevated
 * @param {number} coPpm - CO concentration in PPM
 * @param {number} temperature - Temperature in Celsius
 * @param {number} gasPercent - Gas/smoke level percentage
 * @param {object} thresholds - Threshold values
 * @returns {boolean} True if fire risk detected
 */
function detectFireRisk(coPpm, temperature, gasPercent, thresholds = {}) {
  const coThreshold = thresholds.coWarning || CO_THRESHOLDS.WARNING;
  const tempThreshold = thresholds.tempWarning || 50; // 10 degrees below typical alarm
  const gasThreshold = thresholds.gasWarning || 30; // Below typical alarm threshold

  return (
    coPpm >= coThreshold &&
    temperature >= tempThreshold &&
    gasPercent >= gasThreshold
  );
}

/**
 * Apply moving average filter to smooth sensor readings
 * @param {number[]} readings - Array of recent readings
 * @param {number} windowSize - Number of readings to average (default 10)
 * @returns {number} Smoothed value
 */
function applyMovingAverage(readings, windowSize = 10) {
  if (!Array.isArray(readings) || readings.length === 0) {
    return 0;
  }

  // Take the last N readings
  const window = readings.slice(-windowSize);
  
  // Calculate average
  const sum = window.reduce((acc, val) => acc + val, 0);
  return sum / window.length;
}

/**
 * Check if sensor readings indicate a stuck/faulty sensor
 * @param {number[]} readings - Array of recent readings
 * @param {number} minReadings - Minimum readings to check (default 60 for ~60 seconds at 1/sec)
 * @returns {boolean} True if sensor appears stuck
 */
function isSensorStuck(readings, minReadings = 60) {
  if (!Array.isArray(readings) || readings.length < minReadings) {
    return false;
  }

  const recentReadings = readings.slice(-minReadings);
  const firstReading = recentReadings[0];

  // Check if all readings are identical (stuck at same value)
  const allSame = recentReadings.every(r => r === firstReading);
  
  // Also check if stuck at min (0) or max (4095 for ADC)
  const stuckAtMin = firstReading === 0 && allSame;
  const stuckAtMax = firstReading >= 4095 && allSame;

  return stuckAtMin || stuckAtMax || allSame;
}

/**
 * Check if device is still in warmup period
 * @param {number} bootTime - Timestamp when device booted (ms)
 * @param {number} currentTime - Current timestamp (ms)
 * @param {number} warmupDuration - Warmup duration in ms (default 180000 = 3 minutes)
 * @returns {boolean} True if still warming up, false when warmup complete
 */
function isWarmingUp(bootTime, currentTime, warmupDuration = 180000) {
  if (bootTime === undefined || bootTime === null || currentTime === undefined || currentTime === null) {
    return true; // Assume warming up if times not provided
  }
  const elapsed = currentTime - bootTime;
  // Still warming up if elapsed time is strictly less than warmup duration
  // At exactly warmupDuration or beyond, warmup is complete
  return elapsed < warmupDuration;
}

/**
 * Filter gas history records by time range
 * @param {Array} records - Array of records with timestamp field
 * @param {string} range - Time range: '24h', '7d', or '30d'
 * @param {Date} now - Current date (optional, defaults to now)
 * @returns {Array} Filtered records within the time range
 */
function filterByTimeRange(records, range, now = new Date()) {
  if (!Array.isArray(records)) {
    return [];
  }

  const nowMs = now.getTime();
  let cutoffMs;

  switch (range) {
    case '24h':
      cutoffMs = nowMs - (24 * 60 * 60 * 1000);
      break;
    case '7d':
      cutoffMs = nowMs - (7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      cutoffMs = nowMs - (30 * 24 * 60 * 60 * 1000);
      break;
    default:
      cutoffMs = nowMs - (24 * 60 * 60 * 1000); // Default to 24h
  }

  return records.filter(record => {
    const recordTime = new Date(record.timestamp).getTime();
    return recordTime >= cutoffMs && recordTime <= nowMs;
  });
}

module.exports = {
  // Calculation functions
  calculateCOPpm,
  calculateAQI,
  
  // Status classification
  getCOStatus,
  getAQIStatus,
  
  // Detection functions
  detectFireRisk,
  isSensorStuck,
  isWarmingUp,
  
  // Filtering functions
  applyMovingAverage,
  filterByTimeRange,
  
  // Constants (exported for testing)
  CO_THRESHOLDS,
  AQI_LEVELS,
  MQ7_CURVE
};
