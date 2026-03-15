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

// Require admin session (not PIN) for critical actions
const requireAdmin = (req, res, next) => {
  // Check if user has admin session
  if (req.session.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
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
    const storedSmokeThreshold = device.current?.smokeThreshold;
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

    // Don't let ESP32 data overwrite stored thresholds
    const { threshold: _, smokeThreshold: __, tempThreshold: ___, sirenEnabled: ____, ...dataWithoutThresholds } = data;
    
    device.current = {
      ...device.current, 
      ...dataWithoutThresholds,
      coStatus,
      aqiStatus,
      fireRisk,
      threshold: storedThreshold ?? 40,
      smokeThreshold: storedSmokeThreshold ?? 40,
      tempThreshold: storedTempThreshold ?? 60,
      sirenEnabled: storedSirenEnabled ?? true,
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
        smoke: data.smoke || 0,
        smokeRaw: data.smokeRaw || 0,
        smokeStatus: data.smokeStatus || 'normal',
        temperature: data.temperature,
        humidity: data.humidity,
        gas: data.gas,
        alertLevel,
        alertTriggers
      });
    }

    // Handle fire alarm
    if (!wasAlarm && isAlarm) {
      // Determine what triggered the alarm using stored thresholds
      const gasThreshold = storedThreshold ?? 40;
      const smokeThresholdVal = storedSmokeThreshold ?? 40;
      const tempThresholdVal = storedTempThreshold ?? 60;
      
      const gasTriggered = data.gas >= gasThreshold;
      const smokeTriggered = data.smoke >= smokeThresholdVal;
      const tempTriggered = data.temperature >= tempThresholdVal;
      
      let trigger = 'unknown';
      if ((gasTriggered || smokeTriggered) && tempTriggered) {
        trigger = 'both';
      } else if (smokeTriggered) {
        trigger = 'smoke';
      } else if (gasTriggered) {
        trigger = 'gas';
      } else if (tempTriggered) {
        trigger = 'temperature';
      }
      
      // Enhanced debugging
      console.log('[Alarm] DETAILED Trigger detection:', {
        'data.gas': data.gas, 
        'gasThreshold': gasThreshold, 
        'gasTriggered': gasTriggered,
        'data.smoke': data.smoke, 
        'smokeThreshold': smokeThresholdVal, 
        'smokeTriggered': smokeTriggered,
        'data.temperature': data.temperature, 
        'tempThreshold': tempThresholdVal, 
        'tempTriggered': tempTriggered,
        'FINAL_TRIGGER': trigger,
        'Logic Check': {
          'bothCondition': (gasTriggered || smokeTriggered) && tempTriggered,
          'smokeOnly': smokeTriggered && !tempTriggered,
          'gasOnly': gasTriggered && !tempTriggered,
          'tempOnly': tempTriggered && !gasTriggered && !smokeTriggered
        }
      });
      
      // Format timestamp in Philippines timezone
      const phTime = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
      
      await AlarmHistory.create({
        deviceId, trigger,
        gas: data.gas, 
        smoke: data.smoke,
        coPpm: data.coPpm,
        aqi: data.aqi,
        temperature: data.temperature, 
        humidity: data.humidity,
        timestamp: phTime
      });

      await sendPushNotification(deviceId, {
        title: '🔥 FIRE ALARM!',
        body: `${trigger === 'gas' ? 'Gas' : trigger === 'smoke' ? 'Smoke' : trigger === 'temperature' ? 'Temp' : 'Gas+Temp'} - Gas: ${data.gas?.toFixed(1)}%, Smoke: ${data.smoke?.toFixed(1)}%, Temp: ${data.temperature?.toFixed(1)}°C`,
        vibrate: [200, 100, 200], tag: 'fire-alarm', requireInteraction: true
      });

      // Send Email notification to household admin
      try {
        const { sendAlarmEmail } = require('../utils/email');
        console.log('[Alarm] Checking email conditions:');
        console.log('  - household exists:', !!household);
        console.log('  - adminEmailAlerts:', household?.adminEmailAlerts);
        console.log('  - admin email:', household?.admin?.email);
        
        if (household && household.adminEmailAlerts !== false && household.admin?.email) {
          console.log('[Alarm] Attempting to send email to:', household.admin.email);
          const phTimeEmail = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
          const emailResult = await sendAlarmEmail(household.admin.email, {
            deviceId,
            trigger,
            gas: data.gas,
            smoke: data.smoke,
            temperature: data.temperature,
            humidity: data.humidity,
            timestamp: phTimeEmail
          });
          console.log(`[Alarm] Email sent successfully to admin: ${household.admin.email}`, emailResult);
        } else {
          console.log('[Alarm] Email NOT sent - conditions not met');
        }
      } catch (emailError) {
        console.error('[Alarm] Email notification error:', emailError.message, emailError.stack);
      }
    }

    // Handle partial warnings (smoke or gas detected but no temperature rise)
    if (data.partialWarning && !wasAlarm) {
      let warningType = '';
      let warningMessage = '';
      
      if (data.smokeWarningOnly && data.gasWarningOnly) {
        warningType = 'smoke_gas_warning';
        warningMessage = `Smoke (${data.smoke?.toFixed(1)}%) and Gas (${data.gas?.toFixed(1)}%) detected but no temperature rise`;
      } else if (data.smokeWarningOnly) {
        warningType = 'smoke_warning';
        warningMessage = `Smoke detected (${data.smoke?.toFixed(1)}%) but no temperature rise`;
      } else if (data.gasWarningOnly) {
        warningType = 'gas_warning';
        warningMessage = `Gas detected (${data.gas?.toFixed(1)}%) but no temperature rise`;
      }
      
      console.log(`[Partial Warning] ${warningMessage}`);
      
      // Create history record for partial warning
      try {
        const phTime = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
        await AlarmHistory.create({
          deviceId, 
          trigger: warningType,
          gas: data.gas,
          smoke: data.smoke,
          temperature: data.temperature,
          humidity: data.humidity,
          voltage: data.voltage,
          coPpm: data.coPpm,
          aqi: data.aqi,
          baselineTemp: data.baselineTemp,
          tempRise: data.tempRise,
          timestamp: phTime,
          createdAt: new Date()
        });
        console.log(`[Partial Warning] History record created: ${warningType}`);
      } catch (historyError) {
        console.error('[Partial Warning] Failed to create history record:', historyError.message);
      }
      
      // Send Email notification for partial warning
      try {
        const { sendAlarmEmail } = require('../utils/email');
        if (household && household.adminEmailAlerts !== false && household.admin?.email) {
          console.log('[Partial Warning] Sending email to:', household.admin.email);
          const phTimeEmail = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
          const emailResult = await sendAlarmEmail(household.admin.email, {
            deviceId,
            trigger: warningType,
            gas: data.gas,
            smoke: data.smoke,
            temperature: data.temperature,
            humidity: data.humidity,
            baselineTemp: data.baselineTemp,
            tempRise: data.tempRise,
            timestamp: phTimeEmail,
            isWarningOnly: true
          });
          console.log(`[Partial Warning] Email sent successfully to admin: ${household.admin.email}`, emailResult);
        }
      } catch (emailError) {
        console.error('[Partial Warning] Email notification error:', emailError.message);
      }

      // Send push notification for partial warning
      const notificationTitle = data.smokeWarningOnly && data.gasWarningOnly ? 
        '⚠️ SMOKE & GAS WARNING' : 
        data.smokeWarningOnly ? '⚠️ SMOKE WARNING' : '⚠️ GAS WARNING';
        
      await sendPushNotification(deviceId, {
        title: notificationTitle,
        body: `${warningMessage}. Temp: ${data.temperature?.toFixed(1)}°C (baseline: ${data.baselineTemp?.toFixed(1)}°C)`,
        vibrate: [100, 50, 100, 50, 100], tag: 'partial-warning', requireInteraction: false
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
          // Include CO thresholds in the data broadcast for auto-revert functionality
          const dataWithThresholds = { ...device.current };
          if (device.commands) {
            dataWithThresholds.coWarningThreshold = device.commands.coWarningThreshold;
            dataWithThresholds.coDangerThreshold = device.commands.coDangerThreshold;
            dataWithThresholds.coCriticalThreshold = device.commands.coCriticalThreshold;
          }
          client.send(JSON.stringify({ type: 'data', data: dataWithThresholds }));
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
    
    // Build response with thresholds from device.current (persistent)
    // and action commands from device.commands (one-time)
    const response = {};
    
    // Always include current thresholds so ESP32 stays in sync
    if (device.current) {
      if (device.current.threshold !== undefined) response.threshold = device.current.threshold;
      if (device.current.smokeThreshold !== undefined) response.smokeThreshold = device.current.smokeThreshold;
      if (device.current.tempThreshold !== undefined) response.tempThreshold = device.current.tempThreshold;
      if (device.current.sirenEnabled !== undefined) response.sirenEnabled = device.current.sirenEnabled;
    }
    
    // Include smartAlarmMode from household settings
    response.smartAlarmMode = household.smartAlarmMode || false;
    
    // Include CO thresholds from commands (they persist there)
    if (device.commands) {
      if (device.commands.coWarningThreshold !== undefined) response.coWarningThreshold = device.commands.coWarningThreshold;
      if (device.commands.coDangerThreshold !== undefined) response.coDangerThreshold = device.commands.coDangerThreshold;
      if (device.commands.coCriticalThreshold !== undefined) response.coCriticalThreshold = device.commands.coCriticalThreshold;
      
      // One-time action commands - include then clear
      if (device.commands.silence) response.silence = true;
      if (device.commands.calibrate) response.calibrate = true;
      if (device.commands.resetWifi) {
        response.resetWifi = true;
        console.log(`[Commands] Sending resetWifi=true to device ${req.params.deviceId}`);
      }
    }
    
    // Clear only the one-time action commands
    if (device.commands) {
      if (device.commands.silence || device.commands.calibrate || device.commands.resetWifi) {
        console.log(`[Commands] Clearing one-time commands for device ${req.params.deviceId}`);
      }
      device.commands.silence = undefined;
      device.commands.calibrate = undefined;
      device.commands.resetWifi = undefined;
      await device.save();
    }
    
    res.json(response);
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
    else if (command === 'smokeThreshold') device.current.smokeThreshold = value;
    else if (command === 'sirenEnabled') device.current.sirenEnabled = value;
    
    await device.save();

    // Check if device is online (lastSeen within 30 seconds)
    const isDeviceOnline = device.lastSeen && (Date.now() - device.lastSeen.getTime()) < 30000;

    // Only broadcast data if device is actually online
    if (isDeviceOnline) {
      const wss = req.app.get('wss');
      if (wss) {
        wss.clients.forEach(client => {
          if (client.deviceId === deviceId && client.authenticated && client.readyState === 1) {
            // Include CO thresholds in the data broadcast for auto-revert functionality
            const dataWithThresholds = { ...device.current };
            if (device.commands) {
              dataWithThresholds.coWarningThreshold = device.commands.coWarningThreshold;
              dataWithThresholds.coDangerThreshold = device.commands.coDangerThreshold;
              dataWithThresholds.coCriticalThreshold = device.commands.coCriticalThreshold;
            }
            client.send(JSON.stringify({ type: 'data', data: dataWithThresholds }));
          }
        });
      }
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

    // Check if device is online (lastSeen within 30 seconds)
    const isDeviceOnline = device.lastSeen && (Date.now() - device.lastSeen.getTime()) < 30000;

    // Only broadcast data if device is actually online
    if (isDeviceOnline) {
      const wss = req.app.get('wss');
      if (wss) {
        wss.clients.forEach(client => {
          if (client.deviceId === deviceId && client.authenticated && client.readyState === 1) {
            // Include CO thresholds in the data broadcast for auto-revert functionality
            const dataWithThresholds = { ...device.current };
            if (device.commands) {
              dataWithThresholds.coWarningThreshold = device.commands.coWarningThreshold;
              dataWithThresholds.coDangerThreshold = device.commands.coDangerThreshold;
              dataWithThresholds.coCriticalThreshold = device.commands.coCriticalThreshold;
            }
            client.send(JSON.stringify({ type: 'data', data: dataWithThresholds }));
          }
        });
      }
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

// Reset WiFi settings on device (requires admin PIN)
router.post('/:deviceId/reset-wifi', verifySession, requireAdmin, async (req, res) => {
  try {
    const { deviceId } = req.params;
    console.log(`[WiFi Reset] Request received for device: ${deviceId}`);

    if (!req.household.devices.find(d => d.deviceId === deviceId)) {
      console.log(`[WiFi Reset] Device ${deviceId} not in household`);
      return res.status(403).json({ error: 'Device not in household' });
    }

    let device = await Device.findOne({ deviceId });
    if (!device) {
      console.log(`[WiFi Reset] Device ${deviceId} not found in database`);
      return res.status(404).json({ error: 'Device not found' });
    }

    // Set WiFi reset command for ESP32 to pick up
    if (!device.commands) device.commands = {};
    device.commands.resetWifi = true;
    await device.save();
    
    console.log(`[WiFi Reset] Command saved for device: ${deviceId}, commands:`, device.commands);

    res.json({ 
      success: true, 
      message: 'WiFi reset command sent. Device will restart in setup mode. Connect to "FireWire-Setup" network to configure new WiFi.' 
    });
  } catch (error) {
    console.error('WiFi reset error:', error);
    res.status(500).json({ error: 'Failed to reset WiFi' });
  }
});

// Get historical statistics (today/week/month)
router.get('/:deviceId/stats/:period', verifySession, async (req, res) => {
  try {
    const { deviceId, period } = req.params;

    if (!req.household.devices.find(d => d.deviceId === deviceId)) {
      return res.status(403).json({ error: 'Device not in household' });
    }

    // Calculate date range based on period
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        return res.status(400).json({ error: 'Invalid period. Use: today, week, month' });
    }

    // Aggregate statistics from GasHistory
    const stats = await GasHistory.aggregate([
      {
        $match: {
          deviceId: deviceId,
          timestamp: { $gte: startDate, $lte: now }
        }
      },
      {
        $group: {
          _id: null,
          // Temperature stats
          tempMin: { $min: '$temperature' },
          tempMax: { $max: '$temperature' },
          tempAvg: { $avg: '$temperature' },
          // Humidity stats
          humMin: { $min: '$humidity' },
          humMax: { $max: '$humidity' },
          humAvg: { $avg: '$humidity' },
          // Gas stats
          gasMin: { $min: '$gas' },
          gasMax: { $max: '$gas' },
          gasAvg: { $avg: '$gas' },
          // Smoke stats (normalized to match display - show 0 when below 3%)
          smokeMin: { 
            $min: { 
              $cond: [
                { $lt: ['$smoke', 3] }, 
                0, 
                '$smoke'
              ] 
            } 
          },
          smokeMax: { 
            $max: { 
              $cond: [
                { $lt: ['$smoke', 3] }, 
                0, 
                '$smoke'
              ] 
            } 
          },
          smokeAvg: { 
            $avg: { 
              $cond: [
                { $lt: ['$smoke', 3] }, 
                0, 
                '$smoke'
              ] 
            } 
          },
          // CO stats (allow true zero readings but don't force zeros)
          coMin: { $min: '$coPpm' },
          coMax: { $max: '$coPpm' },
          coAvg: { $avg: '$coPpm' },
          // AQI stats (allow true zero readings but don't force zeros)
          aqiMin: { $min: '$aqi' },
          aqiMax: { $max: '$aqi' },
          aqiAvg: { $avg: '$aqi' },
          // Counts
          totalReadings: { $sum: 1 },
          warningCount: {
            $sum: { $cond: [{ $in: ['$alertLevel', ['warning', 'danger', 'critical', 'fire_risk']] }, 1, 0] }
          },
          dangerCount: {
            $sum: { $cond: [{ $in: ['$alertLevel', ['danger', 'critical', 'fire_risk']] }, 1, 0] }
          }
        }
      }
    ]);

    // Get first and last reading timestamps
    const firstReading = await GasHistory.findOne(
      { deviceId, timestamp: { $gte: startDate } },
      { timestamp: 1 },
      { sort: { timestamp: 1 } }
    );
    
    const lastReading = await GasHistory.findOne(
      { deviceId, timestamp: { $gte: startDate } },
      { timestamp: 1 },
      { sort: { timestamp: -1 } }
    );

    const result = stats[0] || {
      tempMin: null, tempMax: null, tempAvg: null,
      humMin: null, humMax: null, humAvg: null,
      gasMin: null, gasMax: null, gasAvg: null,
      smokeMin: null, smokeMax: null, smokeAvg: null,
      coMin: null, coMax: null, coAvg: null,
      aqiMin: null, aqiMax: null, aqiAvg: null,
      totalReadings: 0, warningCount: 0, dangerCount: 0
    };

    res.json({
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      firstReading: firstReading?.timestamp || null,
      lastReading: lastReading?.timestamp || null,
      stats: {
        temperature: {
          min: result.tempMin,
          max: result.tempMax,
          avg: result.tempAvg
        },
        humidity: {
          min: result.humMin,
          max: result.humMax,
          avg: result.humAvg
        },
        gas: {
          min: result.gasMin,
          max: result.gasMax,
          avg: result.gasAvg
        },
        smoke: {
          min: result.smokeMin,
          max: result.smokeMax,
          avg: result.smokeAvg
        },
        co: {
          min: result.coMin,
          max: result.coMax,
          avg: result.coAvg
        },
        aqi: {
          min: result.aqiMin,
          max: result.aqiMax,
          avg: result.aqiAvg
        }
      },
      totalReadings: result.totalReadings,
      warningCount: result.warningCount,
      dangerCount: result.dangerCount
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

module.exports = router;
