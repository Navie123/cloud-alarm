const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true },
  name: { type: String, default: 'Fire Alarm Device' },
  current: {
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
    heap: Number
  },
  commands: {
    threshold: Number,
    tempThreshold: Number,
    sirenEnabled: Boolean,
    silence: Boolean
  },
  lastSeen: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Device', deviceSchema);
