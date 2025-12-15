const express = require('express');
const router = express.Router();
const Household = require('../models/Household');
const Device = require('../models/Device');

// Middleware to verify session
const verifySession = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Access denied. Please login.' });
  }

  try {
    const household = await Household.findOne({ 'sessions.token': token });
    if (!household) {
      return res.status(401).json({ error: 'Invalid session. Please login again.' });
    }

    const session = household.validateSession(token);
    if (!session) {
      return res.status(401).json({ error: 'Session expired. Please login again.' });
    }

    req.household = household;
    req.session = session;
    req.isAdmin = session.role === 'admin';
    next();
  } catch (error) {
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Middleware to require admin
const requireAdmin = (req, res, next) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Admin access required for this action' });
  }
  next();
};

// Setup new household (first time setup)
router.post('/setup', async (req, res) => {
  try {
    const { deviceId, householdName, accessCode, adminPin } = req.body;

    // Validate inputs
    if (!deviceId || !accessCode || !adminPin) {
      return res.status(400).json({ error: 'Device ID, access code, and admin PIN are required' });
    }
    if (!/^\d{6}$/.test(accessCode)) {
      return res.status(400).json({ error: 'Access code must be exactly 6 digits' });
    }
    if (!/^\d{4}$/.test(adminPin)) {
      return res.status(400).json({ error: 'Admin PIN must be exactly 4 digits' });
    }

    // Check if device exists
    let device = await Device.findOne({ deviceId });
    if (!device) {
      // Create device if it doesn't exist
      device = new Device({ deviceId, name: householdName || 'Fire Alarm Device' });
      await device.save();
    }

    // Check if household already exists for this device
    const existing = await Household.findOne({ deviceId });
    if (existing) {
      return res.status(400).json({ error: 'This device is already set up. Use login instead.' });
    }

    // Create household
    const household = new Household({
      name: householdName || 'My Home',
      deviceId,
      accessCode,
      adminPin
    });

    // Create admin session
    const session = household.createSession('admin');
    await household.save();

    res.status(201).json({
      message: 'Household setup complete!',
      token: session.token,
      role: 'admin',
      householdName: household.name
    });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ error: 'Setup failed' });
  }
});

// Login with access code (viewer) or access code + admin PIN (admin)
router.post('/login', async (req, res) => {
  try {
    const { accessCode, adminPin } = req.body;

    if (!accessCode) {
      return res.status(400).json({ error: 'Access code is required' });
    }

    // Find household by trying access code against all households
    const households = await Household.find({});
    let matchedHousehold = null;

    for (const h of households) {
      if (await h.verifyAccessCode(accessCode)) {
        matchedHousehold = h;
        break;
      }
    }

    if (!matchedHousehold) {
      return res.status(401).json({ error: 'Invalid access code' });
    }

    // Determine role
    let role = 'viewer';
    if (adminPin) {
      const isAdmin = await matchedHousehold.verifyAdminPin(adminPin);
      if (isAdmin) {
        role = 'admin';
      } else {
        return res.status(401).json({ error: 'Invalid admin PIN' });
      }
    }

    // Create session
    const session = matchedHousehold.createSession(role);
    await matchedHousehold.save();

    res.json({
      message: 'Login successful',
      token: session.token,
      role,
      householdName: matchedHousehold.name,
      deviceId: matchedHousehold.deviceId // Only for internal use
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
router.post('/logout', verifySession, async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    req.household.removeSession(token);
    await req.household.save();
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current session info
router.get('/me', verifySession, async (req, res) => {
  res.json({
    householdName: req.household.name,
    role: req.session.role,
    isAdmin: req.isAdmin,
    deviceId: req.household.deviceId
  });
});

// Upgrade to admin (viewer enters admin PIN)
router.post('/upgrade', verifySession, async (req, res) => {
  try {
    const { adminPin } = req.body;

    if (!adminPin) {
      return res.status(400).json({ error: 'Admin PIN is required' });
    }

    const isValid = await req.household.verifyAdminPin(adminPin);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid admin PIN' });
    }

    // Update session role
    const token = req.headers.authorization?.replace('Bearer ', '');
    const sessionIndex = req.household.sessions.findIndex(s => s.token === token);
    if (sessionIndex >= 0) {
      req.household.sessions[sessionIndex].role = 'admin';
      await req.household.save();
    }

    res.json({ message: 'Upgraded to admin', role: 'admin' });
  } catch (error) {
    res.status(500).json({ error: 'Upgrade failed' });
  }
});

// Change access code (admin only)
router.put('/access-code', verifySession, requireAdmin, async (req, res) => {
  try {
    const { newAccessCode } = req.body;

    if (!/^\d{6}$/.test(newAccessCode)) {
      return res.status(400).json({ error: 'Access code must be exactly 6 digits' });
    }

    req.household.accessCode = newAccessCode;
    await req.household.save();

    res.json({ message: 'Access code updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update access code' });
  }
});

// Change admin PIN (admin only)
router.put('/admin-pin', verifySession, requireAdmin, async (req, res) => {
  try {
    const { currentPin, newPin } = req.body;

    // Verify current PIN
    const isValid = await req.household.verifyAdminPin(currentPin);
    if (!isValid) {
      return res.status(401).json({ error: 'Current PIN is incorrect' });
    }

    if (!/^\d{4}$/.test(newPin)) {
      return res.status(400).json({ error: 'New PIN must be exactly 4 digits' });
    }

    req.household.adminPin = newPin;
    await req.household.save();

    res.json({ message: 'Admin PIN updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update admin PIN' });
  }
});

// Update household name (admin only)
router.put('/name', verifySession, requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    req.household.name = name || 'My Home';
    await req.household.save();
    res.json({ message: 'Household name updated', name: req.household.name });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update name' });
  }
});

// Update SMS settings (admin only)
router.put('/sms', verifySession, requireAdmin, async (req, res) => {
  try {
    const { phoneNumber, enabled } = req.body;

    if (phoneNumber) {
      const cleaned = phoneNumber.replace(/\s|-/g, '');
      if (!/^(\+?63|0)?9\d{9}$/.test(cleaned)) {
        return res.status(400).json({ error: 'Invalid Philippine phone number' });
      }
    }

    req.household.smsSettings = {
      phoneNumber: phoneNumber || '',
      enabled: enabled === true
    };
    await req.household.save();

    res.json({
      message: 'SMS settings updated',
      smsSettings: req.household.smsSettings
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update SMS settings' });
  }
});

// Check if device has household setup
router.get('/check/:deviceId', async (req, res) => {
  try {
    const household = await Household.findOne({ deviceId: req.params.deviceId });
    res.json({
      exists: !!household,
      householdName: household?.name
    });
  } catch (error) {
    res.status(500).json({ error: 'Check failed' });
  }
});

module.exports = { router, verifySession, requireAdmin };
