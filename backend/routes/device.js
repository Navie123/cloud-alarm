const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const AlarmHistory = require('../models/AlarmHistory');
const Household = require('../models/Household');
const { sendPushNotification } = require('../utils/push');

// Middleware to verify household session
const verifySession = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }

  const household = await Household.findOne({ 'sessions.token': token });
  if (!household) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  const session = household.verifySession(token);
  if (!session) {
    return res.status(401).json({ error: 'Session expired' });
  }

  req.household = household;
  req.session = session;
  next();
};

// Require admin PIN for critical actions
const requireAdmin = (req, res, next) => {
  const pin = req.header('X-Admin-PIN');
  if (!pin || pin !== req.household.adminPin) {
    return res.status(403).json({ error: 'Admin PIN required', requirePin: true });
  }
  next();
};

// Get device data (requires session)
router.get('/:deviceId', verifySession, async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    // Verify device belongs to household
    if (!req.household.devices.find(d => d.deviceId === deviceId)) {
      return res.status(403).json({ error: 'Device not in your household' });
    }

    let device = await Device.findOne({ deviceId });
    if (!device) {
      device = new Device({ 
        deviceId,
        current: {
          gas: 0, temperature: 0, humidity: 0, voltage: 0,
          threshold: 40, tempThreshold: 60, sirenEnabled: true,
          alarm: false, timestamp: new Date().toLocaleString()
        }
      });
      await device.save();
    }
    res.json(device);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get device data' });
  }
});

// ESP32 data endpoint (uses device secret, not session)
router.post('/:deviceId/data', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const deviceSecret = req.header('X-Device-Secret');
    const data = req.body;

    // Verify device credentials
    const household = await Household.findOne({
      'devices.deviceId': deviceId,
      'devices.deviceSecret': deviceSecret
    });
    
    if (!household) {
      return res.status(401).json({ error: 'Invalid device credentials' });
    }

    let device = await Device.findOne({ deviceId });
    if (!device) device = new Device({ deviceId });

    const wasAlarm = device.current?.alarm;
    const isAlarm = data.alarm;

    const storedThreshold = device.current?.threshold;
    const storedTempThreshold = device.current?.tempThreshold;
    const storedSirenEnabled = device.current?.sirenEnabled;

    device.current = {
      ...device.current, ...data,
      threshold: storedThreshold ?? data.threshold ?? 40,
      tempThreshold: storedTempThreshold ?? data.tempThreshold ?? 60,
      sirenEnabled: storedSirenEnabled ?? data.sirenEnabled ?? true,
      timestamp: new Date().toLocaleString()
    };
    device.lastSeen = new Date();
    await device.save();

    if (!wasAlarm && isAlarm) {
      const trigger = data.gas > (data.threshold || 40) && data.temperature > (data.tempThreshold || 60)
        ? 'both' : data.gas > (data.threshold || 40) ? 'gas' : 'temperature';
      
      await AlarmHistory.create({
        deviceId, trigger,
        gas: data.gas, temperature: data.temperature, humidity: data.humidity,
        timestamp: new Date().toLocaleString()
      });

      await sendPushNotification(deviceId, {
        title: '🔥 FIRE ALARM!',
        body: `${trigger === 'gas' ? 'Gas' : trigger === 'temperature' ? 'Temp' : 'Gas+Temp'} - ${data.gas?.toFixed(1)}%, ${data.temperature?.toFixed(1)}°C`,
        vibrate: [200, 100, 200], tag: 'fire-alarm', requireInteraction: true
      });
    }

    // Broadcast to WebSocket clients
    const wss = req.app.get('wss');
    if (wss) {
      wss.clients.forEach(client => {
        if (client.deviceId === deviceId && client.authenticated && 
            client.householdId === household.householdId && client.readyState === 1) {
          client.send(JSON.stringify({ type: 'data', data: device.current }));
        }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Device data error:', error);
    res.status(500).json({ error: 'Failed to update' });
  }
});

// Get pending commands (ESP32 polls this)
router.get('/:deviceId/commands', async (req, res) => {
  try {
    const deviceSecret = req.header('X-Device-Secret');
    const household = await Household.findOne({
      'devices.deviceId': req.params.deviceId,
      'devices.deviceSecret': deviceSecret
    });
    if (!household) return res.status(401).json({ error: 'Invalid credentials' });

    const device = await Device.findOne({ deviceId: req.params.deviceId });
    if (!device) return res.json({});
    
    const commands = device.commands || {};
    device.commands = {};
    await device.save();
    res.json(commands);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get commands' });
  }
});

// Send command (requires session + admin PIN)
router.post('/:deviceId/command', verifySession, requireAdmin, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { command, value } = req.body;

    if (!req.household.devices.find(d => d.deviceId === deviceId)) {
      return res.status(403).json({ error: 'Device not in household' });
    }

    let device = await Device.findOne({ deviceId });
    if (!device) device = new Device({ deviceId });

    if (!device.commands) device.commands = {};
    device.commands[command] = value;
    
    if (!device.current) device.current = {};
    if (command === 'threshold') device.current.threshold = value;
    else if (command === 'tempThreshold') device.current.tempThreshold = value;
    else if (command === 'sirenEnabled') device.current.sirenEnabled = value;
    
    await device.save();

    const wss = req.app.get('wss');
    if (wss) {
      wss.clients.forEach(client => {
        if (client.deviceId === deviceId && client.authenticated && client.readyState === 1) {
          client.send(JSON.stringify({ type: 'data', data: device.current }));
        }
      });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send command' });
  }
});

// Silence alarm (requires admin PIN)
router.post('/:deviceId/silence', verifySession, requireAdmin, async (req, res) => {
  try {
    const { deviceId } = req.params;
    if (!req.household.devices.find(d => d.deviceId === deviceId)) {
      return res.status(403).json({ error: 'Device not in household' });
    }

    let device = await Device.findOne({ deviceId });
    if (!device) return res.status(404).json({ error: 'Device not found' });

    if (!device.commands) device.commands = {};
    device.commands.silence = true;
    if (device.current) device.current.alarm = false;
    await device.save();

    const wss = req.app.get('wss');
    if (wss) {
      wss.clients.forEach(client => {
        if (client.deviceId === deviceId && client.authenticated && client.readyState === 1) {
          client.send(JSON.stringify({ type: 'data', data: device.current }));
        }
      });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to silence' });
  }
});

// Get history (requires session)
router.get('/:deviceId/history', verifySession, async (req, res) => {
  try {
    if (!req.household.devices.find(d => d.deviceId === req.params.deviceId)) {
      return res.status(403).json({ error: 'Device not in household' });
    }
    const history = await AlarmHistory.find({ deviceId: req.params.deviceId })
      .sort({ createdAt: -1 }).limit(50);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// Clear history (requires admin PIN)
router.delete('/:deviceId/history', verifySession, requireAdmin, async (req, res) => {
  try {
    if (!req.household.devices.find(d => d.deviceId === req.params.deviceId)) {
      return res.status(403).json({ error: 'Device not in household' });
    }
    await AlarmHistory.deleteMany({ deviceId: req.params.deviceId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear history' });
  }
});

module.exports = router;
