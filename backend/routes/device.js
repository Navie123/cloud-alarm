const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const AlarmHistory = require('../models/AlarmHistory');
const GasHistory = require('../models/GasHistory');
const Household = require('../models/Household');
const { sendPushNotification } = require('../utils/push');
const { getCOStatus, getAQIStatus, detectFireRisk, filterByTimeRange } = require('../utils/gasSensor');

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
    const wasFireRisk = device.current?.fireRisk;

    const storedThreshold = device.current?.threshold;
    const storedTempThreshold = device.current?.tempThreshold;
    const storedSirenEnabled = device.current?.sirenEnabled;

    // Process gas sensor data if present
    let coStatus = data.coStatus || 'normal';
    let aqiStatus = data.aqiStatus || 'good';
    let fireRisk = false;

    // Calculate status from PPM/AQI if raw values provided but status not
    if (data.coPpm !== undefined && !data.coStatus) {
      const thresholds = {
        WARNING: device.commands?.coWarningThreshold || 35,
        DANGER: device.commands?.coDangerThreshold || 100,
        CRITICAL: device.commands?.coCriticalThreshold || 400
      };
      coStatus = getCOStatus(data.coPpm, thresholds);
    }

    if (data.aqi !== undefined && !data.aqiStatus) {
      aqiStatus = getAQIStatus(data.aqi);
    }

    // Detect fire risk (cross-sensor correlation)
    if (!data.sensorWarmup && data.coPpm !== undefined) {
      fireRisk = detectFireRisk(
        data.coPpm || 0,
        data.temperature || 0,
        data.gas || 0,
        {
          coWarning: device.commands?.coWarningThreshold || 35,
          tempWarning: (storedTempThreshold || 60) - 10,
          gasWarning: (storedThreshold || 40) - 10
        }
      );
    }

    device.current = {
      ...device.current, 
      ...data,
      coStatus,
      aqiStatus,
      fireRisk,
      threshold: storedThreshold ?? data.threshold ?? 40,
      tempThreshold: storedTempThreshold ?? data.tempThreshold ?? 60,
      sirenEnabled: storedSirenEnabled ?? data.sirenEnabled ?? true,
      timestamp: new Date().toLocaleString()
    };
    device.lastSeen = new Date();
    await device.save();

    // Store gas history record (every update, for trending)
    if (data.coPpm !== undefined || data.aqi !== undefined) {
      const alertTriggers = [];
      let alertLevel = 'none';

      if (fireRisk) {
        alertLevel = 'fire_risk';
        alertTriggers.push('co', 'temperature', 'gas');
      } else if (coStatus === 'critical') {
        alertLevel = 'critical';
        alertTriggers.push('co');
      } else if (coStatus === 'danger' || aqiStatus === 'unhealthy') {
        alertLevel = 'danger';
        if (coStatus === 'danger') alertTriggers.push('co');
        if (aqiStatus === 'unhealthy') alertTriggers.push('aqi');
      } else if (coStatus === 'warning' || aqiStatus === 'unhealthy_sensitive') {
        alertLevel = 'warning';
        if (coStatus === 'warning') alertTriggers.push('co');
        if (aqiStatus === 'unhealthy_sensitive') alertTriggers.push('aqi');
      }

      await GasHistory.create({
        deviceId,
        coPpm: data.coPpm || 0,
        coRaw: data.coRaw || 0,
        coStatus,
        aqi: data.aqi || 0,
        aqiRaw: data.aqiRaw || 0,
        aqiStatus,
        temperature: data.temperature,
        humidity: data.humidity,
        gas: data.gas,
        alertLevel,
        alertTriggers
      });
    }

    // Handle fire alarm
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

    // Handle fire risk alert (new)
    if (!wasFireRisk && fireRisk) {
      await sendPushNotification(deviceId, {
        title: '🚨 FIRE RISK DETECTED!',
        body: `Multiple sensors triggered: CO ${data.coPpm?.toFixed(0)} PPM, Temp ${data.temperature?.toFixed(1)}°C, Gas ${data.gas?.toFixed(1)}%`,
        vibrate: [300, 100, 300, 100, 300], tag: 'fire-risk', requireInteraction: true
      });
    }

    // Handle CO danger/critical alerts
    const wasCOStatus = device.current?.coStatus;
    if (coStatus === 'danger' && wasCOStatus !== 'danger' && wasCOStatus !== 'critical') {
      await sendPushNotification(deviceId, {
        title: '⚠️ CO DANGER!',
        body: `Carbon Monoxide at ${data.coPpm?.toFixed(0)} PPM - Ventilate immediately!`,
        vibrate: [200, 100, 200], tag: 'co-danger', requireInteraction: true
      });
    } else if (coStatus === 'critical' && wasCOStatus !== 'critical') {
      await sendPushNotification(deviceId, {
        title: '🚨 CO CRITICAL!',
        body: `Carbon Monoxide at ${data.coPpm?.toFixed(0)} PPM - EVACUATE NOW!`,
        vibrate: [300, 100, 300, 100, 300], tag: 'co-critical', requireInteraction: true
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

// Get gas sensor history (requires session)
router.get('/:deviceId/gas-history', verifySession, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { range = '24h' } = req.query;

    if (!req.household.devices.find(d => d.deviceId === deviceId)) {
      return res.status(403).json({ error: 'Device not in household' });
    }

    // Calculate time cutoff based on range
    const now = new Date();
    let cutoff;
    switch (range) {
      case '7d':
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '24h':
      default:
        cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    const history = await GasHistory.find({
      deviceId,
      timestamp: { $gte: cutoff, $lte: now }
    }).sort({ timestamp: -1 }).limit(1000);

    res.json(history);
  } catch (error) {
    console.error('Gas history error:', error);
    res.status(500).json({ error: 'Failed to get gas history' });
  }
});

// Trigger sensor calibration (requires admin PIN)
router.post('/:deviceId/calibrate', verifySession, requireAdmin, async (req, res) => {
  try {
    const { deviceId } = req.params;

    if (!req.household.devices.find(d => d.deviceId === deviceId)) {
      return res.status(403).json({ error: 'Device not in household' });
    }

    let device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Set calibration command for ESP32 to pick up
    if (!device.commands) device.commands = {};
    device.commands.calibrate = true;
    await device.save();

    res.json({ success: true, message: 'Calibration command sent to device' });
  } catch (error) {
    console.error('Calibration error:', error);
    res.status(500).json({ error: 'Failed to trigger calibration' });
  }
});

// Get calibration status (requires session)
router.get('/:deviceId/calibration-status', verifySession, async (req, res) => {
  try {
    const { deviceId } = req.params;

    if (!req.household.devices.find(d => d.deviceId === deviceId)) {
      return res.status(403).json({ error: 'Device not in household' });
    }

    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({
      lastCalibration: device.current?.lastCalibration || null,
      coRo: device.current?.coRo || 10000,
      aqiRo: device.current?.aqiRo || 10000,
      calibrationPending: device.commands?.calibrate || false
    });
  } catch (error) {
    console.error('Calibration status error:', error);
    res.status(500).json({ error: 'Failed to get calibration status' });
  }
});

// Update CO thresholds (requires admin PIN)
router.post('/:deviceId/co-thresholds', verifySession, requireAdmin, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { warning, danger, critical } = req.body;

    if (!req.household.devices.find(d => d.deviceId === deviceId)) {
      return res.status(403).json({ error: 'Device not in household' });
    }

    let device = await Device.findOne({ deviceId });
    if (!device) device = new Device({ deviceId });

    if (!device.commands) device.commands = {};
    if (warning !== undefined) device.commands.coWarningThreshold = Math.max(10, Math.min(50, warning));
    if (danger !== undefined) device.commands.coDangerThreshold = Math.max(50, Math.min(200, danger));
    if (critical !== undefined) device.commands.coCriticalThreshold = Math.max(200, Math.min(800, critical));
    
    await device.save();

    // Broadcast updated thresholds
    const wss = req.app.get('wss');
    if (wss) {
      wss.clients.forEach(client => {
        if (client.deviceId === deviceId && client.authenticated && client.readyState === 1) {
          client.send(JSON.stringify({ 
            type: 'thresholds', 
            data: {
              coWarningThreshold: device.commands.coWarningThreshold,
              coDangerThreshold: device.commands.coDangerThreshold,
              coCriticalThreshold: device.commands.coCriticalThreshold
            }
          }));
        }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('CO thresholds error:', error);
    res.status(500).json({ error: 'Failed to update CO thresholds' });
  }
});

module.exports = router;
