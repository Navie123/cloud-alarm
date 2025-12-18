const mongoose = require('mongoose');

/**
 * GasHistory Model
 * Stores historical gas sensor readings for trend analysis and reporting
 */
const gasHistorySchema = new mongoose.Schema({
  deviceId: { 
    type: String, 
    required: true, 
    index: true 
  },
  
  // MQ-7 CO readings
  coPpm: { type: Number, default: 0 },
  coRaw: { type: Number, default: 0 },
  coStatus: { type: String, default: 'normal' },
  
  // MQ-135 AQI readings
  aqi: { type: Number, default: 0 },
  aqiRaw: { type: Number, default: 0 },
  aqiStatus: { type: String, default: 'good' },
  
  // Environmental context
  temperature: { type: Number },
  humidity: { type: Number },
  gas: { type: Number },
  
  // Alert information
  alertLevel: { 
    type: String, 
    enum: ['none', 'warning', 'danger', 'critical', 'fire_risk'],
    default: 'none'
  },
  alertTriggers: [{ type: String }], // Which sensors triggered the alert
  
  timestamp: { 
    type: Date, 
    default: Date.now, 
    index: true 
  }
});

// Compound index for efficient time-range queries by device
gasHistorySchema.index({ deviceId: 1, timestamp: -1 });

// Index for alert queries
gasHistorySchema.index({ deviceId: 1, alertLevel: 1, timestamp: -1 });

// TTL index to auto-delete records older than 90 days (optional, saves storage)
// gasHistorySchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('GasHistory', gasHistorySchema);
