const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const AlarmHistory = require('../models/AlarmHistory');
const { auth } = require('../middleware/auth');
const { sendPushNotification } = require('../utils/push');

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

    // Update current data
    device.current = {
      ...device.current,
      ...data,
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

    // Set command
    if (!device.commands) device.commands = {};
    device.commands[command] = value;
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
