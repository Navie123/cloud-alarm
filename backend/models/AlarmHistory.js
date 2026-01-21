const mongoose = require('mongoose');

const alarmHistorySchema = new mongoose.Schema({
  deviceId: { type: String, required: true, index: true },
  trigger: { type: String, enum: ['gas', 'smoke', 'temperature', 'both', 'co', 'unknown', 'smoke_warning', 'gas_warning', 'smoke_gas_warning'], required: true },
  gas: Number,
  smoke: Number,
  coPpm: Number,
  aqi: Number,
  temperature: Number,
  humidity: Number,
  timestamp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Index for efficient queries
alarmHistorySchema.index({ deviceId: 1, createdAt: -1 });

module.exports = mongoose.model('AlarmHistory', alarmHistorySchema);
