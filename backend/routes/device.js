const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const AlarmHistory = require('../models/AlarmHistory');
const Household = require('../models/Household');
const { sendPushNotification } = require('../utils/push');
const { sendAlarmSMS } = require('../utils/sms');

// Middleware to verify household session
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

// Middleware to require admin for settings changes
const requireAdmin = (req, res, next) => {
  if (!req.isAdmin) {
    return res.status(403).json({ 
      error: 'Admin access required',
      message: 'Only admins can change device settings. Enter your admin PIN to upgrade.'
    });
  }
  next();
};

// Get device data (all authenticated users)
router.get('/:deviceId', verifySession, async (req, res) => {
  try {
    // Verify user has access to this device
    if (req.household.deviceId !== req.params.deviceId) {
      return res.status(403).json({ error: 'Access denied to this device' });
    }

    const device = await Device.findOne({ deviceId: req.params.deviceId });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    res.json(device);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get device data' });
  }
});

// Update device data (from ESP32 - no auth required, uses device ID)
router.post('/:deviceId/data', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const data = req.body;
    console.log(`[ESP32] Data from ${deviceId}:`, JSON.stringify(data).substring(0, 100));

    let device = await Device.findOne({ deviceId });
    if (!device) {
      device = new Device({ deviceId });
    }

    // Check if alarm state changed to active
    const wasAlarm = device.current?.alarm;
    const isAlarm = data.alarm;

    // Preserve user-set thresholds
    const storedThreshold = device.current?.threshold;
    const storedTempThreshold = device.current?.tempThreshold;
    const storedSirenEnabled = device.current?.sirenEnabled;

    device.current = {
      ...device.current,
      ...data,
      threshold: storedThreshold !== undefined ? storedThreshold : (data.threshold || 40),
      tempThreshold: storedTempThreshold !== undefined ? storedTempThreshold : (data.tempThreshold || 60),
      sirenEnabled: storedSirenEnabled !== undefined ? storedSirenEnabled : (data.sirenEnabled !== false),
      timestamp: new Date().toLocaleString()
    };
    device.lastSeen = new Date();
    await device.save();

    // If alarm just triggered
    if (!wasAlarm && isAlarm) {
      const trigger = data.gas > (data.threshold || 40) && data.temperature > (data.tempThreshold || 60) 
        ? 'both' 
        : data.gas > (data.threshold || 40) ? 'gas' : 'temperature';
      
      // Save to history
      await AlarmHistory.create({
        deviceId,
        trigger,
        gas: data.gas,
        temperature: data.temperature,
        humidity: data.humidity,
        timestamp: new Date().toLocaleString()
      });

      // Send push notifications
      await sendPushNotification(deviceId, {
        title: '🔥 FIRE ALARM!',
        body: `${trigger === 'gas' ? 'Gas detected' : trigger === 'temperature' ? 'High temperature' : 'Gas + High temp'} - Gas: ${data.gas?.toFixed(1)}%, Temp: ${data.temperature?.toFixed(1)}°C`,
        icon: '/icon-192.png',
        badge: '/badge.png',
        vibrate: [200, 100, 200, 100, 200],
        tag: 'fire-alarm',
        requireInteraction: true
      });

      // Send SMS if enabled for this household
      const household = await Household.findOne({ deviceId });
      if (household?.smsSettings?.enabled && household?.smsSettings?.phoneNumber) {
        await sendAlarmSMS(household.smsSettings.phoneNumber, {
          trigger,
          gas: data.gas,
          temperature: data.temperature
        });
      }
    }

    // Broadcast to WebSocket clients
    const wss = req.app.get('wss');
    if (wss) {
      wss.clients.forEach(client => {
        if (client.deviceId === deviceId && client.readyState === 1) {
          client.send(JSON.stringify({ type: 'data', data: device.current }));
        }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Device data error:', error);
    res.status(500).json({ error: 'Failed to update device data' });
  }
});

// Get pending commands for device (ESP32 polls this)
router.get('/:deviceId/commands', async (req, res) => {
  try {
    const device = await Device.findOne({ deviceId: req.params.deviceId });
    if (!device) {
      return res.json({});
    }
    
    const commands = device.commands || {};
    device.commands = {};
    await device.save();
    
    res.json(commands);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get commands' });
  }
});

// Send command to device - ADMIN ONLY for threshold/settings changes
router.post('/:deviceId/command', verifySession, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { command, value } = req.body;

    // Verify user has access to this device
    if (req.household.deviceId !== deviceId) {
      return res.status(403).json({ error: 'Access denied to this device' });
    }

    // Admin-only commands
    const adminOnlyCommands = ['threshold', 'tempThreshold', 'sirenEnabled'];
    if (adminOnlyCommands.includes(command) && !req.isAdmin) {
      return res.status(403).json({ 
        error: 'Admin access required',
        message: 'Only admins can change sensor thresholds and siren settings.'
      });
    }

    let device = await Device.findOne({ deviceId });
    if (!device) {
      device = new Device({ deviceId });
    }

    // Set command for ESP32 to fetch
    if (!device.commands) device.commands = {};
    device.commands[command] = value;
    
    // Update stored value immediately
    if (!device.current) device.current = {};
    if (command === 'threshold') {
      device.current.threshold = value;
    } else if (command === 'tempThreshold') {
      device.current.tempThreshold = value;
    } else if (command === 'sirenEnabled') {
      device.current.sirenEnabled = value;
    }
    
    await device.save();

    // Broadcast to WebSocket
    const wss = req.app.get('wss');
    if (wss) {
      wss.clients.forEach(client => {
        if (client.deviceId === deviceId && client.isDevice && client.readyState === 1) {
          client.send(JSON.stringify({ type: 'command', command, value }));
        }
      });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send command' });
  }
});

// Silence alarm - ALL users can do this (safety feature)
router.post('/:deviceId/silence', verifySession, async (req, res) => {
  try {
    const { deviceId } = req.params;

    if (req.household.deviceId !== deviceId) {
      return res.status(403).json({ error: 'Access denied to this device' });
    }

    let device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    if (!device.commands) device.commands = {};
    device.commands.silence = true;
    await device.save();

    res.json({ success: true, message: 'Alarm silenced' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to silence alarm' });
  }
});

// Get alarm history (all authenticated users)
router.get('/:deviceId/history', verifySession, async (req, res) => {
  try {
    if (req.household.deviceId !== req.params.deviceId) {
      return res.status(403).json({ error: 'Access denied to this device' });
    }

    const history = await AlarmHistory.find({ deviceId: req.params.deviceId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// Clear alarm history - ADMIN ONLY
router.delete('/:deviceId/history', verifySession, requireAdmin, async (req, res) => {
  try {
    if (req.household.deviceId !== req.params.deviceId) {
      return res.status(403).json({ error: 'Access denied to this device' });
    }

    await AlarmHistory.deleteMany({ deviceId: req.params.deviceId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear history' });
  }
});

module.exports = router;
