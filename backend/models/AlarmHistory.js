const mongoose = require('mongoose');

const alarmHistorySchema = new mongoose.Schema({
  deviceId: { type: String, required: true, index: true },
  trigger: { type: String, enum: ['gas', 'smoke', 'temperature', 'both', 'co', 'unknown'], required: true },
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
