const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const Household = require('../models/Household');
const { sendOTPEmail } = require('../utils/email');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ============ MIDDLEWARE ============

// Verify household session (for household access)
const verifyHouseholdSession = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Access denied' });

  const household = await Household.findOne({ 'sessions.token': token });
  if (!household) return res.status(401).json({ error: 'Invalid session' });

  const session = household.verifySession(token);
  if (!session) return res.status(401).json({ error: 'Session expired' });

  req.household = household;
  req.session = session;
  next();
};

// Verify admin session
const verifyAdminSession = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Access denied' });

  const household = await Household.findOne({ 'sessions.token': token });
  if (!household) return res.status(401).json({ error: 'Invalid session' });

  const session = household.verifySession(token);
  if (!session || session.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  req.household = household;
  req.session = session;
  next();
};

// ============ SETUP FLOW (First-Time) ============

// Check if any household exists (for first-time setup detection)
router.get('/check-setup', async (req, res) => {
  const count = await Household.countDocuments({ setupComplete: true });
  res.json({ needsSetup: count === 0 });
});

// Step 1: Admin initiates setup with Google OAuth
router.post('/setup/google', async (req, res) => {
  try {
    const { credential } = req.body;

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, email_verified } = payload;

    // Must be Gmail
    if (!email.endsWith('@gmail.com')) {
      return res.status(400).json({ error: 'Only Gmail accounts are allowed for Admin' });
    }

    // Check if household already exists with this email
    let household = await Household.findOne({ 'admin.email': email });
    
    if (household && household.setupComplete) {
      return res.status(400).json({ error: 'This email is already registered as Admin' });
    }

    // Create or update household
    if (!household) {
      household = new Household({
        householdId: Household.generateHouseholdId(),
        admin: { email, googleId, emailVerified: false }
      });
    } else {
      household.admin.googleId = googleId;
    }

    // Generate and send OTP
    const otp = household.generateOTP('setup');
    await household.save();

    // Send OTP email
    await sendOTPEmail(email, otp, 'setup');

    res.json({
      success: true,
      email,
      message: 'Verification code sent to your Gmail'
    });
  } catch (error) {
    console.error('Setup Google error:', error);
    res.status(500).json({ error: 'Setup failed' });
  }
});

// Step 2: Verify OTP during setup
router.post('/setup/verify-otp', async (req, res) => {
  try {
    const { email, code } = req.body;

    const household = await Household.findOne({ 'admin.email': email });
    if (!household) {
      return res.status(404).json({ error: 'Setup not found. Please start again.' });
    }

    if (!household.verifyOTP(code, 'setup')) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    household.admin.emailVerified = true;
    household.clearOTP();
    await household.save();

    res.json({
      success: true,
      householdId: household.householdId,
      message: 'Email verified! Now set your Admin PIN and Access Code.'
    });
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Step 3: Complete setup (set PIN, access code, device)
router.post('/setup/complete', async (req, res) => {
  try {
    const { email, adminPin, accessCode, householdName, deviceId } = req.body;

    const household = await Household.findOne({ 'admin.email': email });
    if (!household) {
      return res.status(404).json({ error: 'Setup not found' });
    }

    if (!household.admin.emailVerified) {
      return res.status(400).json({ error: 'Email not verified' });
    }

    // Validate PIN (4-6 digits)
    if (!adminPin || !/^\d{4,6}$/.test(adminPin)) {
      return res.status(400).json({ error: 'Admin PIN must be 4-6 digits' });
    }

    // Validate access code (6 digits)
    if (!accessCode || !/^\d{6}$/.test(accessCode)) {
      return res.status(400).json({ error: 'Access code must be 6 digits' });
    }

    // Set values
    household.setPin(adminPin);
    household.accessCode = accessCode;
    household.name = householdName || 'My Household';
    household.setupComplete = true;

    // Register device if provided
    let deviceSecret = null;
    if (deviceId) {
      deviceSecret = crypto.randomBytes(16).toString('hex');
      household.devices.push({
        deviceId,
        deviceSecret,
        name: 'Fire Alarm'
      });
    }

    await household.save();

    res.json({
      success: true,
      householdId: household.householdId,
      deviceSecret,
      message: 'Setup complete! Your Cloud Fire Alarm is ready.'
    });
  } catch (error) {
    console.error('Setup complete error:', error);
    res.status(500).json({ error: 'Setup failed' });
  }
});

// ============ HOUSEHOLD ACCESS (View Only) ============

// Join with Household ID + Access Code
router.post('/join', async (req, res) => {
  try {
    const { householdId, accessCode, memberName } = req.body;

    const household = await Household.findOne({ householdId, setupComplete: true });
    if (!household) {
      return res.status(404).json({ error: 'Household not found' });
    }

    if (household.accessCode !== accessCode) {
      return res.status(401).json({ error: 'Invalid access code' });
    }

    household.cleanSessions();
    
    // Check if member with this name already exists (case-insensitive)
    let memberId;
    let isReturningMember = false;
    const normalizedName = (memberName || 'Member').trim().toLowerCase();
    
    const existingMember = household.members.find(m => 
      m.name && m.name.trim().toLowerCase() === normalizedName
    );
    
    if (existingMember) {
      // Returning member - use existing ID
      memberId = existingMember._id.toString();
      isReturningMember = true;
      console.log(`[Household] Returning member: ${existingMember.name}`);
    } else {
      // New member - add to list
      const displayName = memberName ? memberName.trim() : 'Member';
      household.members.push({ name: displayName });
      memberId = household.members[household.members.length - 1]._id.toString();
      console.log(`[Household] New member joined: ${displayName}`);
    }
    
    const { token, expiresAt } = household.createSession('household', memberId);

    await household.save();

    res.json({
      success: true,
      token,
      expiresAt,
      memberId,
      isReturningMember,
      householdName: household.name,
      accessType: 'household',
      devices: household.devices.map(d => ({ deviceId: d.deviceId, name: d.name }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to join household' });
  }
});

// ============ ADMIN LOGIN (Elevated Access) ============

// Check if device is trusted (can skip OTP)
router.post('/admin/check-trusted', async (req, res) => {
  try {
    const { householdId, email, trustedToken } = req.body;

    const household = await Household.findOne({ householdId, setupComplete: true });
    if (!household) {
      return res.status(404).json({ error: 'Household not found' });
    }

    if (household.admin.email !== email) {
      return res.status(401).json({ error: 'Invalid admin email' });
    }

    // Check if trusted device token is valid
    household.cleanTrustedDevices();
    const trustedDevice = trustedToken ? household.verifyTrustedDevice(trustedToken) : null;
    
    if (trustedDevice) {
      await household.save();
    }

    res.json({
      success: true,
      isTrusted: !!trustedDevice,
      deviceName: trustedDevice?.name || null
    });
  } catch (error) {
    res.status(500).json({ error: 'Check failed' });
  }
});

// Step 1: Request OTP for admin login (skip if trusted)
router.post('/admin/request-otp', async (req, res) => {
  try {
    const { householdId, email, trustedToken } = req.body;

    const household = await Household.findOne({ householdId, setupComplete: true });
    if (!household) {
      return res.status(404).json({ error: 'Household not found' });
    }

    if (household.admin.email !== email) {
      return res.status(401).json({ error: 'This email is not the Admin for this household' });
    }

    // Check if device is trusted - skip OTP
    household.cleanTrustedDevices();
    const trustedDevice = trustedToken ? household.verifyTrustedDevice(trustedToken) : null;
    
    if (trustedDevice) {
      await household.save();
      return res.json({
        success: true,
        skipOTP: true,
        deviceName: trustedDevice.name,
        message: 'Device recognized. Enter PIN to continue.'
      });
    }

    // Generate and send OTP
    const otp = household.generateOTP('login');
    await household.save();

    await sendOTPEmail(email, otp, 'login');

    res.json({
      success: true,
      skipOTP: false,
      message: 'Verification code sent to your Gmail'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// Step 2: Verify OTP + PIN for admin login (or just PIN if trusted)
router.post('/admin/login', async (req, res) => {
  try {
    const { householdId, email, code, pin, trustedToken, rememberDevice, deviceName } = req.body;

    const household = await Household.findOne({ householdId, setupComplete: true });
    if (!household) {
      return res.status(404).json({ error: 'Household not found' });
    }

    if (household.admin.email !== email) {
      return res.status(401).json({ error: 'Invalid admin email' });
    }

    // Check if device is trusted
    household.cleanTrustedDevices();
    const trustedDevice = trustedToken ? household.verifyTrustedDevice(trustedToken) : null;

    // If not trusted, verify OTP
    if (!trustedDevice) {
      if (!household.verifyOTP(code, 'login')) {
        return res.status(400).json({ error: 'Invalid or expired verification code' });
      }
    }

    // Verify PIN (always required)
    if (!household.verifyPin(pin)) {
      return res.status(401).json({ error: 'Invalid Admin PIN' });
    }

    household.clearOTP();
    household.cleanSessions();
    const { token, expiresAt } = household.createSession('admin');

    // Create trusted device token if requested
    let newTrustedToken = null;
    if (rememberDevice && !trustedDevice) {
      const trusted = household.createTrustedDevice(deviceName || 'Browser');
      newTrustedToken = trusted.token;
    }

    await household.save();

    res.json({
      success: true,
      token,
      expiresAt,
      accessType: 'admin',
      householdName: household.name,
      devices: household.devices.map(d => ({ deviceId: d.deviceId, name: d.name })),
      trustedToken: newTrustedToken
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// ============ HOUSEHOLD INFO ============

router.get('/info', verifyHouseholdSession, (req, res) => {
  const h = req.household;
  res.json({
    householdId: h.householdId,
    name: h.name,
    accessType: req.session.type,
    devices: h.devices.map(d => ({ deviceId: d.deviceId, name: d.name })),
    members: h.members.map(m => m.name)
  });
});

// Get detailed members list (Admin only)
router.get('/members', verifyAdminSession, (req, res) => {
  const h = req.household;
  res.json({
    admin: {
      email: h.admin.email,
      createdAt: h.admin.createdAt
    },
    members: h.members.map(m => ({
      id: m._id,
      name: m.name,
      email: m.email || null,
      emailAlerts: m.emailAlerts || false,
      addedAt: m.addedAt
    })),
    totalMembers: h.members.length
  });
});

// Remove a member (Admin only)
router.delete('/members/:memberId', verifyAdminSession, async (req, res) => {
  try {
    const { memberId } = req.params;
    
    const memberIndex = req.household.members.findIndex(m => m._id.toString() === memberId);
    if (memberIndex === -1) {
      return res.status(404).json({ error: 'Member not found' });
    }
    
    const removedMember = req.household.members[memberIndex];
    req.household.members.splice(memberIndex, 1);
    
    // Also remove any sessions for this member
    req.household.sessions = req.household.sessions.filter(s => s.memberId !== memberId);
    
    await req.household.save();
    
    res.json({ success: true, message: `Removed ${removedMember.name}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Clear all members (Admin only)
router.delete('/members/clear', verifyAdminSession, async (req, res) => {
  try {
    const count = req.household.members.length;
    req.household.members = [];
    
    // Remove all household sessions (keep admin sessions)
    req.household.sessions = req.household.sessions.filter(s => s.type === 'admin');
    
    await req.household.save();
    
    res.json({ success: true, message: `Removed ${count} members` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear members' });
  }
});

// Verify admin PIN (for sensitive actions)
router.post('/verify-pin', verifyAdminSession, async (req, res) => {
  try {
    const { pin } = req.body;
    
    if (!pin) {
      return res.status(400).json({ error: 'PIN required' });
    }
    
    const isValid = req.household.verifyPin(pin);
    
    if (isValid) {
      res.json({ success: true });
    } else {
      res.status(401).json({ error: 'Invalid PIN' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Get household credentials (Admin only)
router.get('/credentials', verifyAdminSession, (req, res) => {
  res.json({
    householdId: req.household.householdId,
    accessCode: req.household.accessCode,
    adminEmail: req.household.admin.email
  });
});

// Logout
router.post('/logout', verifyHouseholdSession, async (req, res) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  req.household.sessions = req.household.sessions.filter(s => s.token !== token);
  await req.household.save();
  res.json({ success: true });
});

// ============ ADMIN-ONLY ACTIONS ============

// Change access code
router.put('/access-code', verifyAdminSession, async (req, res) => {
  try {
    const { newCode } = req.body;
    if (!/^\d{6}$/.test(newCode)) {
      return res.status(400).json({ error: 'Access code must be 6 digits' });
    }

    req.household.accessCode = newCode;
    // Invalidate all household sessions
    req.household.sessions = req.household.sessions.filter(s => s.type === 'admin');
    await req.household.save();

    res.json({ success: true, message: 'Access code changed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change access code' });
  }
});

// Change admin PIN
router.put('/admin-pin', verifyAdminSession, async (req, res) => {
  try {
    const { currentPin, newPin } = req.body;

    if (!req.household.verifyPin(currentPin)) {
      return res.status(401).json({ error: 'Current PIN is incorrect' });
    }

    if (!/^\d{4,6}$/.test(newPin)) {
      return res.status(400).json({ error: 'PIN must be 4-6 digits' });
    }

    req.household.setPin(newPin);
    await req.household.save();

    res.json({ success: true, message: 'Admin PIN changed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change PIN' });
  }
});

// Add device
router.post('/devices', verifyAdminSession, async (req, res) => {
  try {
    const { deviceId, name } = req.body;

    if (req.household.devices.find(d => d.deviceId === deviceId)) {
      return res.status(400).json({ error: 'Device already registered' });
    }

    const deviceSecret = crypto.randomBytes(16).toString('hex');
    req.household.devices.push({ deviceId, deviceSecret, name: name || 'Fire Alarm' });
    await req.household.save();

    res.json({
      success: true,
      device: { deviceId, deviceSecret, name },
      message: 'Save the device secret - it cannot be retrieved later!'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add device' });
  }
});

// Remove device
router.delete('/devices/:deviceId', verifyAdminSession, async (req, res) => {
  try {
    req.household.devices = req.household.devices.filter(d => d.deviceId !== req.params.deviceId);
    await req.household.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove device' });
  }
});

// Get credentials (admin only)
router.get('/credentials', verifyAdminSession, (req, res) => {
  res.json({
    householdId: req.household.householdId,
    accessCode: req.household.accessCode,
    adminEmail: req.household.admin.email
  });
});

// Update household name
router.put('/name', verifyAdminSession, async (req, res) => {
  try {
    req.household.name = req.body.name;
    await req.household.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update name' });
  }
});

// ============ ADMIN RECOVERY ============

// Request password reset
router.post('/admin/reset-request', async (req, res) => {
  try {
    const { householdId, email } = req.body;

    const household = await Household.findOne({ householdId, 'admin.email': email });
    if (!household) {
      // Don't reveal if household exists
      return res.json({ success: true, message: 'If valid, a reset code has been sent' });
    }

    const otp = household.generateOTP('reset');
    await household.save();

    await sendOTPEmail(email, otp, 'reset');

    res.json({ success: true, message: 'Reset code sent to your email' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send reset code' });
  }
});

// Reset PIN with OTP
router.post('/admin/reset-pin', async (req, res) => {
  try {
    const { householdId, email, code, newPin } = req.body;

    const household = await Household.findOne({ householdId, 'admin.email': email });
    if (!household) {
      return res.status(404).json({ error: 'Invalid request' });
    }

    if (!household.verifyOTP(code, 'reset')) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    if (!/^\d{4,6}$/.test(newPin)) {
      return res.status(400).json({ error: 'PIN must be 4-6 digits' });
    }

    household.setPin(newPin);
    household.clearOTP();
    await household.save();

    res.json({ success: true, message: 'PIN reset successful' });
  } catch (error) {
    res.status(500).json({ error: 'Reset failed' });
  }
});

// ============ FACTORY RESET ============

// Factory reset - deletes household and returns to setup
router.post('/admin/factory-reset', verifyAdminSession, async (req, res) => {
  try {
    const { pin, confirmText } = req.body;

    // Verify PIN
    if (!req.household.verifyPin(pin)) {
      return res.status(401).json({ error: 'Invalid Admin PIN' });
    }

    // Require confirmation text
    if (confirmText !== 'RESET') {
      return res.status(400).json({ error: 'Please type RESET to confirm' });
    }

    const householdId = req.household.householdId;

    // Delete the household completely
    await Household.deleteOne({ _id: req.household._id });

    res.json({ 
      success: true, 
      message: 'Factory reset complete. All data has been deleted.',
      householdId 
    });
  } catch (error) {
    console.error('Factory reset error:', error);
    res.status(500).json({ error: 'Factory reset failed' });
  }
});

// ============ EMAIL ALERTS ============

// Get email alert settings for current user
router.get('/email-alerts', verifyHouseholdSession, async (req, res) => {
  try {
    const h = req.household;
    const isAdmin = req.session.type === 'admin';
    
    if (isAdmin) {
      res.json({
        email: h.admin.email,
        emailAlerts: h.adminEmailAlerts !== false, // Default true
        isAdmin: true,
        hasEmail: true
      });
    } else {
      // Find member by memberId
      const member = h.members.find(m => m._id?.toString() === req.session.memberId);
      res.json({
        email: member?.email || null,
        emailAlerts: member?.emailAlerts || false,
        isAdmin: false,
        hasEmail: !!member?.email,
        memberName: member?.name || 'Member'
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to get email settings' });
  }
});

// Toggle email alerts for current user
router.put('/email-alerts', verifyHouseholdSession, async (req, res) => {
  try {
    const { enabled, email } = req.body;
    const h = req.household;
    const isAdmin = req.session.type === 'admin';
    
    if (isAdmin) {
      h.adminEmailAlerts = enabled;
      await h.save();
      res.json({ success: true, emailAlerts: enabled });
    } else {
      // Find or create member entry
      let memberIndex = h.members.findIndex(m => m._id?.toString() === req.session.memberId);
      
      if (memberIndex === -1) {
        // Member doesn't exist yet, create one
        h.members.push({
          name: 'Member',
          email: email || null,
          emailAlerts: enabled
        });
        memberIndex = h.members.length - 1;
      } else {
        // Update existing member
        if (email) h.members[memberIndex].email = email;
        h.members[memberIndex].emailAlerts = enabled;
      }
      
      await h.save();
      res.json({ 
        success: true, 
        emailAlerts: enabled,
        email: h.members[memberIndex].email
      });
    }
  } catch (error) {
    console.error('Email alerts error:', error);
    res.status(500).json({ error: 'Failed to update email settings' });
  }
});

// ============ MEMBER EMAIL VERIFICATION ============

// Step 1: Request email verification code
router.post('/member-email/request-code', verifyHouseholdSession, async (req, res) => {
  try {
    const { email } = req.body;
    const h = req.household;
    
    console.log('[Email Verify] Request for session:', req.session.memberId, 'type:', req.session.type);
    
    if (req.session.type === 'admin') {
      return res.status(400).json({ error: 'Admin email cannot be changed here' });
    }
    
    // Validate email format
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Generate 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    // Find member by session memberId
    let memberIndex = h.members.findIndex(m => m._id?.toString() === req.session.memberId);
    console.log('[Email Verify] Member index:', memberIndex, 'Total members:', h.members.length);
    
    if (memberIndex === -1) {
      // Member not found - create new entry with the session's memberId reference
      // This handles legacy sessions that don't have proper member entries
      const newMember = {
        name: 'Member',
        pendingEmail: email,
        verificationCode: code,
        verificationExpires: expiresAt
      };
      h.members.push(newMember);
      memberIndex = h.members.length - 1;
      
      // Update session to use the new member's _id
      const session = h.sessions.find(s => s.memberId === req.session.memberId);
      if (session) {
        session.memberId = h.members[memberIndex]._id.toString();
      }
    } else {
      h.members[memberIndex].pendingEmail = email;
      h.members[memberIndex].verificationCode = code;
      h.members[memberIndex].verificationExpires = expiresAt;
    }
    
    await h.save();
    
    // Send verification email
    console.log('[Email Verify] Sending OTP to:', email);
    try {
      await sendOTPEmail(email, code, 'member');
    } catch (emailError) {
      console.error('[Email Verify] Email send failed:', emailError);
      return res.status(500).json({ error: 'Failed to send email. Please try again.' });
    }
    
    res.json({ success: true, message: 'Verification code sent to your email' });
  } catch (error) {
    console.error('Member email request error:', error);
    res.status(500).json({ error: error.message || 'Failed to send verification code' });
  }
});

// Step 2: Verify code and save email
router.post('/member-email/verify', verifyHouseholdSession, async (req, res) => {
  try {
    const { code } = req.body;
    const h = req.household;
    
    if (req.session.type === 'admin') {
      return res.status(400).json({ error: 'Admin email cannot be changed here' });
    }
    
    // Find member - check both by _id and by having a pending verification
    let memberIndex = h.members.findIndex(m => m._id?.toString() === req.session.memberId);
    
    // If not found by session ID, find by pending email verification
    if (memberIndex === -1) {
      memberIndex = h.members.findIndex(m => m.verificationCode && m.pendingEmail);
    }
    
    if (memberIndex === -1) {
      return res.status(404).json({ error: 'No pending verification found. Please request a new code.' });
    }
    
    const member = h.members[memberIndex];
    
    // Check if code matches and not expired
    if (!member.verificationCode || member.verificationCode !== code) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }
    
    if (new Date() > member.verificationExpires) {
      return res.status(400).json({ error: 'Verification code expired. Please request a new one.' });
    }
    
    // Verify and save email
    h.members[memberIndex].email = member.pendingEmail;
    h.members[memberIndex].emailVerified = true;
    h.members[memberIndex].emailAlerts = true;
    h.members[memberIndex].pendingEmail = undefined;
    h.members[memberIndex].verificationCode = undefined;
    h.members[memberIndex].verificationExpires = undefined;
    
    await h.save();
    
    res.json({ 
      success: true, 
      email: h.members[memberIndex].email,
      emailAlerts: true,
      message: 'Email verified successfully!' 
    });
  } catch (error) {
    console.error('Member email verify error:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

// Resend verification code
router.post('/member-email/resend', verifyHouseholdSession, async (req, res) => {
  try {
    const h = req.household;
    
    if (req.session.type === 'admin') {
      return res.status(400).json({ error: 'Admin email cannot be changed here' });
    }
    
    // Find member
    let memberIndex = h.members.findIndex(m => m._id?.toString() === req.session.memberId);
    
    if (memberIndex === -1 || !h.members[memberIndex].pendingEmail) {
      return res.status(400).json({ error: 'No pending email verification' });
    }
    
    // Generate new code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    
    h.members[memberIndex].verificationCode = code;
    h.members[memberIndex].verificationExpires = expiresAt;
    
    await h.save();
    
    // Send verification email
    await sendOTPEmail(h.members[memberIndex].pendingEmail, code, 'setup');
    
    res.json({ success: true, message: 'New verification code sent' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resend code' });
  }
});

module.exports = { router, verifyHouseholdSession, verifyAdminSession };
