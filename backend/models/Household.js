const mongoose = require('mongoose');
const crypto = require('crypto');

const householdSchema = new mongoose.Schema({
  // Unique household identifier (10-digit)
  householdId: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: v => /^\d{10}$/.test(v),
      message: 'Household ID must be 10 digits'
    }
  },

  // Household name
  name: { type: String, default: 'My Household' },

  // Setup status
  setupComplete: { type: Boolean, default: false },

  // ============ ADMIN (Single, Required) ============
  admin: {
    email: { type: String, required: true }, // Gmail only
    googleId: String, // From Google OAuth
    emailVerified: { type: Boolean, default: false },
    pin: String, // 4-6 digit PIN (hashed)
    pinHash: String,
    createdAt: { type: Date, default: Date.now }
  },

  // Verification codes (OTP)
  verification: {
    code: String,
    expiresAt: Date,
    purpose: String // 'setup', 'login', 'reset'
  },

  // ============ HOUSEHOLD ACCESS ============
  accessCode: {
    type: String,
    validate: {
      validator: v => /^\d{6}$/.test(v),
      message: 'Access code must be 6 digits'
    }
  },

  // Household members (display names only)
  members: [{
    name: String,
    addedAt: { type: Date, default: Date.now }
  }],

  // ============ DEVICES ============
  devices: [{
    deviceId: { type: String, required: true },
    deviceSecret: { type: String, required: true },
    name: { type: String, default: 'Fire Alarm' },
    registeredAt: { type: Date, default: Date.now }
  }],

  // Push subscriptions (per browser)
  pushSubscriptions: [{
    memberId: String,
    endpoint: String,
    keys: { p256dh: String, auth: String }
  }],

  // ============ SESSIONS ============
  sessions: [{
    token: String,
    type: { type: String, enum: ['household', 'admin'] },
    memberId: String,
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date
  }],

  // ============ TRUSTED DEVICES (Skip OTP) ============
  trustedDevices: [{
    token: String,
    name: String, // Browser/device name
    createdAt: { type: Date, default: Date.now },
    lastUsed: { type: Date, default: Date.now },
    expiresAt: Date // 30 days
  }],

  createdAt: { type: Date, default: Date.now }
});

// Generate 6-digit OTP
householdSchema.methods.generateOTP = function(purpose) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  this.verification = {
    code,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    purpose
  };
  return code;
};

// Verify OTP
householdSchema.methods.verifyOTP = function(code, purpose) {
  if (!this.verification || !this.verification.code) return false;
  if (this.verification.code !== code) return false;
  if (this.verification.purpose !== purpose) return false;
  if (new Date() > this.verification.expiresAt) return false;
  return true;
};

// Clear OTP after use
householdSchema.methods.clearOTP = function() {
  this.verification = undefined;
};

// Hash PIN
householdSchema.methods.setPin = function(pin) {
  this.admin.pinHash = crypto.createHash('sha256').update(pin).digest('hex');
};

// Verify PIN
householdSchema.methods.verifyPin = function(pin) {
  const hash = crypto.createHash('sha256').update(pin).digest('hex');
  return this.admin.pinHash === hash;
};

// Create session
householdSchema.methods.createSession = function(type, memberId = null) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + (type === 'admin' ? 2 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000)); // Admin: 2hrs, Household: 30 days
  
  this.sessions.push({ token, type, memberId, expiresAt });
  return { token, expiresAt };
};

// Verify session
householdSchema.methods.verifySession = function(token) {
  const session = this.sessions.find(s => s.token === token && s.expiresAt > new Date());
  return session || null;
};

// Clean expired sessions
householdSchema.methods.cleanSessions = function() {
  this.sessions = this.sessions.filter(s => s.expiresAt > new Date());
};

// Verify device
householdSchema.methods.verifyDevice = function(deviceId, deviceSecret) {
  return this.devices.find(d => d.deviceId === deviceId && d.deviceSecret === deviceSecret);
};

// Generate household ID
householdSchema.statics.generateHouseholdId = function() {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
};

// Create trusted device token
householdSchema.methods.createTrustedDevice = function(deviceName) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  
  this.trustedDevices.push({ 
    token, 
    name: deviceName || 'Unknown Device',
    expiresAt 
  });
  
  return { token, expiresAt };
};

// Verify trusted device
householdSchema.methods.verifyTrustedDevice = function(token) {
  const device = this.trustedDevices.find(d => d.token === token && d.expiresAt > new Date());
  if (device) {
    device.lastUsed = new Date();
  }
  return device || null;
};

// Remove trusted device
householdSchema.methods.removeTrustedDevice = function(token) {
  this.trustedDevices = this.trustedDevices.filter(d => d.token !== token);
};

// Clean expired trusted devices
householdSchema.methods.cleanTrustedDevices = function() {
  this.trustedDevices = this.trustedDevices.filter(d => d.expiresAt > new Date());
};

module.exports = mongoose.model('Household', householdSchema);
