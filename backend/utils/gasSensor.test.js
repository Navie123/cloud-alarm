/**
 * Property-Based Tests for Gas Sensor Utility Functions
 * Using fast-check for property-based testing
 */

const fc = require('fast-check');
const {
  calculateCOPpm,
  calculateAQI,
  getCOStatus,
  getAQIStatus,
  detectFireRisk,
  applyMovingAverage,
  isSensorStuck,
  isWarmingUp,
  filterByTimeRange,
  CO_THRESHOLDS,
  AQI_LEVELS
} = require('./gasSensor');

describe('Gas Sensor Utility Functions', () => {
  
  /**
   * **Feature: gas-sensor-integration, Property 1: CO PPM Calculation Validity**
   * **Validates: Requirements 1.1**
   * 
   * For any valid ADC reading (0-4095) and positive Ro calibration value,
   * the CO PPM calculation function SHALL produce a non-negative value
   * within the sensor's measurable range (0-1000 PPM).
   */
  describe('Property 1: CO PPM Calculation Validity', () => {
    test('CO PPM is always within valid range (0-1000) for valid inputs', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 4095 }),  // Valid ADC range
          fc.float({ min: 1, max: 100000, noNaN: true }),  // Positive Ro value
          (rawADC, ro) => {
            const ppm = calculateCOPpm(rawADC, ro);
            return ppm >= 0 && ppm <= 1000;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('CO PPM returns 0 for invalid ADC values', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.integer({ min: -1000, max: -1 }),  // Negative ADC
            fc.integer({ min: 4096, max: 10000 })  // Above max ADC
          ),
          fc.float({ min: 1, max: 100000, noNaN: true }),
          (rawADC, ro) => {
            const ppm = calculateCOPpm(rawADC, ro);
            return ppm === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('CO PPM returns 0 for invalid Ro values', () => {
      // Test with zero Ro
      expect(calculateCOPpm(2000, 0)).toBe(0);
      // Test with negative Ro
      expect(calculateCOPpm(2000, -100)).toBe(0);
      expect(calculateCOPpm(2000, -0.001)).toBe(0);
    });
  });

  /**
   * **Feature: gas-sensor-integration, Property 2: CO Status Classification Correctness**
   * **Validates: Requirements 1.2, 1.3, 1.4**
   * 
   * For any CO PPM value, the status classification function SHALL return:
   * - "normal" when PPM < 35
   * - "warning" when 35 ≤ PPM < 100
   * - "danger" when 100 ≤ PPM < 400
   * - "critical" when PPM ≥ 400
   */
  describe('Property 2: CO Status Classification Correctness', () => {
    test('CO status classification is correct for all PPM values', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1000, noNaN: true }),
          (ppm) => {
            const status = getCOStatus(ppm);
            
            if (ppm < CO_THRESHOLDS.WARNING) {
              return status === 'normal';
            }
            if (ppm < CO_THRESHOLDS.DANGER) {
              return status === 'warning';
            }
            if (ppm < CO_THRESHOLDS.CRITICAL) {
              return status === 'danger';
            }
            return status === 'critical';
          }
        ),
        { numRuns: 100 }
      );
    });

    test('CO status at exact threshold boundaries', () => {
      // Exactly at warning threshold (35)
      expect(getCOStatus(35)).toBe('warning');
      expect(getCOStatus(34.99)).toBe('normal');
      
      // Exactly at danger threshold (100)
      expect(getCOStatus(100)).toBe('danger');
      expect(getCOStatus(99.99)).toBe('warning');
      
      // Exactly at critical threshold (400)
      expect(getCOStatus(400)).toBe('critical');
      expect(getCOStatus(399.99)).toBe('danger');
    });
  });

  /**
   * **Feature: gas-sensor-integration, Property 3: AQI Calculation Range Validity**
   * **Validates: Requirements 2.1**
   * 
   * For any valid ADC reading (0-4095) and positive Ro calibration value,
   * the AQI calculation function SHALL produce a value within the valid
   * AQI range (0-500).
   */
  describe('Property 3: AQI Calculation Range Validity', () => {
    test('AQI is always within valid range (0-500) for valid inputs', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 4095 }),
          fc.float({ min: 1, max: 100000, noNaN: true }),
          (rawADC, ro) => {
            const aqi = calculateAQI(rawADC, ro);
            return aqi >= 0 && aqi <= 500;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('AQI returns 0 for invalid inputs', () => {
      expect(calculateAQI(-1, 10000)).toBe(0);
      expect(calculateAQI(5000, 10000)).toBe(0);
      expect(calculateAQI(2000, 0)).toBe(0);
      expect(calculateAQI(2000, -100)).toBe(0);
    });
  });

  /**
   * **Feature: gas-sensor-integration, Property 4: AQI Status Classification Correctness**
   * **Validates: Requirements 2.2, 2.3, 2.4, 2.5**
   * 
   * For any AQI value, the status classification function SHALL return:
   * - "good" when AQI ≤ 50
   * - "moderate" when 51 ≤ AQI ≤ 100
   * - "unhealthy_sensitive" when 101 ≤ AQI ≤ 150
   * - "unhealthy" when AQI > 150
   */
  describe('Property 4: AQI Status Classification Correctness', () => {
    test('AQI status classification is correct for all AQI values', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 500 }),
          (aqi) => {
            const status = getAQIStatus(aqi);
            
            if (aqi <= AQI_LEVELS.GOOD) {
              return status === 'good';
            }
            if (aqi <= AQI_LEVELS.MODERATE) {
              return status === 'moderate';
            }
            if (aqi <= AQI_LEVELS.UNHEALTHY_SENSITIVE) {
              return status === 'unhealthy_sensitive';
            }
            return status === 'unhealthy';
          }
        ),
        { numRuns: 100 }
      );
    });

    test('AQI status at exact threshold boundaries', () => {
      // Good threshold (50)
      expect(getAQIStatus(50)).toBe('good');
      expect(getAQIStatus(51)).toBe('moderate');
      
      // Moderate threshold (100)
      expect(getAQIStatus(100)).toBe('moderate');
      expect(getAQIStatus(101)).toBe('unhealthy_sensitive');
      
      // Unhealthy sensitive threshold (150)
      expect(getAQIStatus(150)).toBe('unhealthy_sensitive');
      expect(getAQIStatus(151)).toBe('unhealthy');
    });
  });
});


describe('Additional Property Tests', () => {
  
  /**
   * **Feature: gas-sensor-integration, Property 5: Fire Risk Detection Logic**
   * **Validates: Requirements 3.1**
   * 
   * For any combination of sensor readings, the fire risk flag SHALL be true
   * if and only if CO PPM exceeds warning threshold AND temperature exceeds
   * warning level AND gas/smoke level exceeds threshold.
   */
  describe('Property 5: Fire Risk Detection Logic', () => {
    test('Fire risk triggers only when ALL conditions are met', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 500, noNaN: true }),   // CO PPM
          fc.float({ min: 20, max: 100, noNaN: true }),  // Temperature
          fc.float({ min: 0, max: 100, noNaN: true }),   // Gas percent
          (coPpm, temperature, gasPercent) => {
            const thresholds = {
              coWarning: 35,
              tempWarning: 50,
              gasWarning: 30
            };
            
            const fireRisk = detectFireRisk(coPpm, temperature, gasPercent, thresholds);
            
            const coExceeded = coPpm >= thresholds.coWarning;
            const tempExceeded = temperature >= thresholds.tempWarning;
            const gasExceeded = gasPercent >= thresholds.gasWarning;
            
            const expectedFireRisk = coExceeded && tempExceeded && gasExceeded;
            
            return fireRisk === expectedFireRisk;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Fire risk is false when any single condition is not met', () => {
      // CO below threshold
      expect(detectFireRisk(30, 60, 50)).toBe(false);
      // Temperature below threshold
      expect(detectFireRisk(50, 40, 50)).toBe(false);
      // Gas below threshold
      expect(detectFireRisk(50, 60, 20)).toBe(false);
      // All conditions met
      expect(detectFireRisk(50, 60, 50)).toBe(true);
    });
  });

  /**
   * **Feature: gas-sensor-integration, Property 6: Moving Average Filter Correctness**
   * **Validates: Requirements 9.1**
   * 
   * For any sequence of N sensor readings where N ≥ 10, the moving average
   * output SHALL equal the arithmetic mean of the most recent 10 readings.
   */
  describe('Property 6: Moving Average Filter Correctness', () => {
    test('Moving average equals mean of last 10 readings', () => {
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: 0, max: 4095, noNaN: true }), { minLength: 10, maxLength: 100 }),
          (readings) => {
            const result = applyMovingAverage(readings, 10);
            const last10 = readings.slice(-10);
            const expectedMean = last10.reduce((a, b) => a + b, 0) / last10.length;
            
            // Allow small floating point tolerance
            return Math.abs(result - expectedMean) < 0.0001;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Moving average handles arrays smaller than window size', () => {
      const readings = [100, 200, 300];
      const result = applyMovingAverage(readings, 10);
      const expectedMean = (100 + 200 + 300) / 3;
      expect(result).toBeCloseTo(expectedMean);
    });

    test('Moving average returns 0 for empty array', () => {
      expect(applyMovingAverage([], 10)).toBe(0);
    });
  });

  /**
   * **Feature: gas-sensor-integration, Property 7: Time Range Filter Correctness**
   * **Validates: Requirements 5.3**
   * 
   * For any set of timestamped records and a time range filter (24h, 7d, or 30d),
   * the filter function SHALL return only records with timestamps within the
   * specified range from the current time.
   */
  describe('Property 7: Time Range Filter Correctness', () => {
    test('24h filter returns only records from last 24 hours', () => {
      const now = new Date();
      const records = [
        { timestamp: new Date(now.getTime() - 12 * 60 * 60 * 1000) }, // 12h ago
        { timestamp: new Date(now.getTime() - 23 * 60 * 60 * 1000) }, // 23h ago
        { timestamp: new Date(now.getTime() - 25 * 60 * 60 * 1000) }, // 25h ago (outside)
        { timestamp: new Date(now.getTime() - 48 * 60 * 60 * 1000) }, // 48h ago (outside)
      ];
      
      const filtered = filterByTimeRange(records, '24h', now);
      expect(filtered.length).toBe(2);
    });

    test('7d filter returns only records from last 7 days', () => {
      const now = new Date();
      const records = [
        { timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) },  // 3 days ago
        { timestamp: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000) },  // 6 days ago
        { timestamp: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000) },  // 8 days ago (outside)
      ];
      
      const filtered = filterByTimeRange(records, '7d', now);
      expect(filtered.length).toBe(2);
    });

    test('30d filter returns only records from last 30 days', () => {
      const now = new Date();
      const records = [
        { timestamp: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000) }, // 15 days ago
        { timestamp: new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000) }, // 29 days ago
        { timestamp: new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000) }, // 31 days ago (outside)
      ];
      
      const filtered = filterByTimeRange(records, '30d', now);
      expect(filtered.length).toBe(2);
    });

    test('Filter excludes future timestamps', () => {
      const now = new Date();
      const records = [
        { timestamp: new Date(now.getTime() + 60 * 60 * 1000) }, // 1h in future
        { timestamp: new Date(now.getTime() - 60 * 60 * 1000) }, // 1h ago
      ];
      
      const filtered = filterByTimeRange(records, '24h', now);
      expect(filtered.length).toBe(1);
    });
  });

  /**
   * **Feature: gas-sensor-integration, Property 8: Warmup Period Alert Blocking**
   * **Validates: Requirements 6.1, 6.2**
   * 
   * For any time T < 180 seconds since device boot, the system SHALL NOT
   * trigger gas sensor alerts regardless of sensor readings.
   */
  describe('Property 8: Warmup Period Alert Blocking', () => {
    test('isWarmingUp returns true for times less than warmup duration', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 179999 }), // Time elapsed in ms (< 180 seconds)
          (elapsedMs) => {
            const bootTime = 0;
            const currentTime = elapsedMs;
            return isWarmingUp(bootTime, currentTime, 180000) === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('isWarmingUp returns false for times >= warmup duration', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 180001, max: 1000000 }), // Time elapsed > 180 seconds
          (elapsedMs) => {
            const bootTime = 0;
            const currentTime = elapsedMs;
            return isWarmingUp(bootTime, currentTime, 180000) === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Warmup boundary at exactly 180 seconds', () => {
      // At 179999ms (just under 180s), still warming up
      expect(isWarmingUp(0, 179999, 180000)).toBe(true);
      // At exactly 180000ms, warmup complete (elapsed >= duration)
      expect(isWarmingUp(0, 180000, 180000)).toBe(false);
      // At 180001ms, definitely done warming up
      expect(isWarmingUp(0, 180001, 180000)).toBe(false);
    });
  });

  /**
   * **Feature: gas-sensor-integration, Property 9: Stuck Sensor Detection**
   * **Validates: Requirements 4.5**
   * 
   * For any sequence of sensor readings where all values are identical
   * for more than 60 consecutive readings, the sensor health warning
   * SHALL be triggered.
   */
  describe('Property 9: Stuck Sensor Detection', () => {
    test('Stuck sensor detected when all readings are identical', () => {
      // 60 identical readings at 0 (stuck at min)
      const stuckAtMin = Array(60).fill(0);
      expect(isSensorStuck(stuckAtMin, 60)).toBe(true);
      
      // 60 identical readings at 4095 (stuck at max)
      const stuckAtMax = Array(60).fill(4095);
      expect(isSensorStuck(stuckAtMax, 60)).toBe(true);
      
      // 60 identical readings at some value
      const stuckAtValue = Array(60).fill(2000);
      expect(isSensorStuck(stuckAtValue, 60)).toBe(true);
    });

    test('Not stuck when readings vary', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 4095 }), { minLength: 60, maxLength: 100 }),
          (readings) => {
            // Ensure at least one reading is different
            const hasVariation = new Set(readings.slice(-60)).size > 1;
            if (hasVariation) {
              return isSensorStuck(readings, 60) === false;
            }
            return true; // Skip if all happen to be same (unlikely)
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Not stuck when fewer than minimum readings', () => {
      const readings = Array(59).fill(0);
      expect(isSensorStuck(readings, 60)).toBe(false);
    });
  });
});
