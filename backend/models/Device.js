const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true },
  name: { type: String, default: 'Fire Alarm Device' },
  current: {
    // Existing sensor fields
    gas: { type: Number, default: 0 },
    temperature: { type: Number, default: 0 },
    humidity: { type: Number, default: 0 },
    voltage: { type: Number, default: 0 },
    threshold: { type: Number, default: 40 },
    tempThreshold: { type: Number, default: 60 },
    alarm: { type: Boolean, default: false },
    tempWarning: { type: String, default: 'normal' },
    sirenEnabled: { type: Boolean, default: true },
    timestamp: String,
    heap: Number,
    
    // MQ-7 Carbon Monoxide sensor fields
    coPpm: { type: Number, default: 0 },
    coRaw: { type: Number, default: 0 },
    coStatus: { type: String, default: 'normal', enum: ['normal', 'warning', 'danger', 'critical'] },
    
    // MQ-135 Air Quality sensor fields
    aqi: { type: Number, default: 0 },
    aqiRaw: { type: Number, default: 0 },
    aqiStatus: { type: String, default: 'good', enum: ['good', 'moderate', 'unhealthy_sensitive', 'unhealthy'] },
    
    // Sensor status flags
    sensorWarmup: { type: Boolean, default: true },
    fireRisk: { type: Boolean, default: false },
    sensorHealth: { type: String, default: 'ok', enum: ['ok', 'warning', 'error'] },
    
    // Calibration info
    lastCalibration: { type: Date },
    coRo: { type: Number, default: 10000 },
    aqiRo: { type: Number, default: 10000 }
  },
  commands: {
    // Existing commands
    threshold: Number,
    tempThreshold: Number,
    sirenEnabled: Boolean,
    silence: Boolean,
    
    // CO threshold commands
    coWarningThreshold: { type: Number, default: 35 },
    coDangerThreshold: { type: Number, default: 100 },
    coCriticalThreshold: { type: Number, default: 400 },
    
    // Calibration command
    calibrate: { type: Boolean, default: false }
  },
  pushSubscriptions: [{
    endpoint: String,
    keys: {
      p256dh: String,
      auth: String
    }
  }],
  lastSeen: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Device', deviceSchema);
