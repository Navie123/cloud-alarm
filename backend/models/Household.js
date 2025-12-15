const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const householdSchema = new mongoose.Schema({
  // Household identification
  name: { type: String, default: 'My Home' },
  
  // Access code for family members (6 digits) - hashed
  accessCode: { type: String, required: true },
  
  // Admin PIN for settings access (4 digits) - hashed
  adminPin: { type: String, required: true },
  
  // Linked device ID (internal, never shown to users)
  deviceId: { type: String, required: true, unique: true },
  
  // Active sessions
  sessions: [{
    token: String,
    role: { type: String, enum: ['viewer', 'admin'], default: 'viewer' },
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date,
    deviceInfo: String
  }],
  
  // Push subscriptions for notifications
  pushSubscriptions: [{
    endpoint: String,
    keys: { p256dh: String, auth: String },
    role: { type: String, enum: ['viewer', 'admin'], default: 'viewer' }
  }],
  
  // SMS settings (admin only can change)
  smsSettings: {
    phoneNumber: String,
    enabled: { type: Boolean, default: false }
  },
  
  createdAt: { type: Date, default: Date.now }
});

// Hash access code before saving
householdSchema.pre('save', async function(next) {
  if (this.isModified('accessCode') && !this.accessCode.startsWith('$2')) {
    this.accessCode = await bcrypt.hash(this.accessCode, 10);
  }
  if (this.isModified('adminPin') && !this.adminPin.startsWith('$2')) {
    this.adminPin = await bcrypt.hash(this.adminPin, 10);
  }
  next();
});

// Verify access code
householdSchema.methods.verifyAccessCode = async function(code) {
  return bcrypt.compare(code, this.accessCode);
};

// Verify admin PIN
householdSchema.methods.verifyAdminPin = async function(pin) {
  return bcrypt.compare(pin, this.adminPin);
};

// Generate session token
householdSchema.methods.createSession = function(role = 'viewer') {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  
  this.sessions.push({ token, role, expiresAt });
  
  // Clean up expired sessions
  this.sessions = this.sessions.filter(s => s.expiresAt > new Date());
  
  return { token, role, expiresAt };
};

// Validate session token
householdSchema.methods.validateSession = function(token) {
  const session = this.sessions.find(s => 
    s.token === token && s.expiresAt > new Date()
  );
  return session || null;
};

// Remove session
householdSchema.methods.removeSession = function(token) {
  this.sessions = this.sessions.filter(s => s.token !== token);
};

module.exports = mongoose.model('Household', householdSchema);
