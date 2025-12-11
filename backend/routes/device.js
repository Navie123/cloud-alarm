const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const AlarmHistory = require('../models/AlarmHistory');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { sendPushNotification } = require('../utils/push');
const { sendAlarmSMS } = require('../utils/sms');

// Get device data
router.get('/:deviceId', auth, async (req, res) => {
  try {
    const device = await Device.findOne({ deviceId: req.params.deviceId });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    res.json(device);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get device data' });
  }
});

// Update device data (from ESP32)
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

    // Use stored thresholds from DB if they exist (user-set values take priority)
    // This prevents ESP32 from overwriting user's threshold settings
    const storedThreshold = device.current?.threshold;
    const storedTempThreshold = device.current?.tempThreshold;
    const storedSirenEnabled = device.current?.sirenEnabled;

    // Update current data but preserve user-set thresholds
    device.current = {
      ...device.current,
      ...data,
      // Keep the stored threshold if it exists and differs from default
      threshold: storedThreshold !== undefined ? storedThreshold : (data.threshold || 40),
      tempThreshold: storedTempThreshold !== undefined ? storedTempThreshold : (data.tempThreshold || 60),
      sirenEnabled: storedSirenEnabled !== undefined ? storedSirenEnabled : (data.sirenEnabled !== false),
      timestamp: new Date().toLocaleString()
    };
    device.lastSeen = new Date();
    await device.save();

    // If alarm just triggered, send push notifications
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

      // Send push notifications to all subscribed users
      await sendPushNotification(deviceId, {
        title: '🔥 FIRE ALARM!',
        body: `${trigger === 'gas' ? 'Gas detected' : trigger === 'temperature' ? 'High temperature' : 'Gas + High temp'} - Gas: ${data.gas?.toFixed(1)}%, Temp: ${data.temperature?.toFixed(1)}°C`,
        icon: '/icon-192.png',
        badge: '/badge.png',
        vibrate: [200, 100, 200, 100, 200],
        tag: 'fire-alarm',
        requireInteraction: true
      });

      // Send SMS to users with SMS enabled
      const usersWithSMS = await User.find({ 
        smsEnabled: true, 
        phoneNumber: { $exists: true, $ne: '' }
      });
      
      for (const user of usersWithSMS) {
        await sendAlarmSMS(user.phoneNumber, {
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

// Get pending commands for device
router.get('/:deviceId/commands', async (req, res) => {
  try {
    const device = await Device.findOne({ deviceId: req.params.deviceId });
    if (!device) {
      return res.json({});
    }
    
    const commands = device.commands || {};
    
    // Clear commands after sending
    device.commands = {};
    await device.save();
    
    res.json(commands);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get commands' });
  }
});

// Send command to device
router.post('/:deviceId/command', auth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { command, value } = req.body;

    let device = await Device.findOne({ deviceId });
    if (!device) {
      device = new Device({ deviceId });
    }

    // Set command for ESP32 to fetch
    if (!device.commands) device.commands = {};
    device.commands[command] = value;
    
    // Also update the stored value in device.current immediately
    // This ensures the UI shows the new value right away
    if (!device.current) device.current = {};
    if (command === 'threshold') {
      device.current.threshold = value;
    } else if (command === 'tempThreshold') {
      device.current.tempThreshold = value;
    } else if (command === 'sirenEnabled') {
      device.current.sirenEnabled = value;
    }
    
    await device.save();

    // Broadcast command to WebSocket (for ESP32 if connected via WS)
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

// Get alarm history
router.get('/:deviceId/history', auth, async (req, res) => {
  try {
    const history = await AlarmHistory.find({ deviceId: req.params.deviceId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// Clear alarm history
router.delete('/:deviceId/history', auth, async (req, res) => {
  try {
    await AlarmHistory.deleteMany({ deviceId: req.params.deviceId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear history' });
  }
});

module.exports = router;
