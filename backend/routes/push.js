const express = require('express');
const router = express.Router();
const Device = require('../models/Device');

// Get VAPID public key
router.get('/vapid-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// Subscribe to push notifications (no auth - stores on device)
router.post('/subscribe', async (req, res) => {
  try {
    const { subscription, deviceId } = req.body;
    const targetDeviceId = deviceId || 'ESP32_001';
    
    let device = await Device.findOne({ deviceId: targetDeviceId });
    if (!device) {
      device = new Device({ deviceId: targetDeviceId });
    }
    
    // Initialize pushSubscriptions array if not exists
    if (!device.pushSubscriptions) {
      device.pushSubscriptions = [];
    }
    
    // Check if subscription already exists
    const existingSub = device.pushSubscriptions.find(
      s => s.endpoint === subscription.endpoint
    );
    
    if (!existingSub) {
      device.pushSubscriptions.push({
        endpoint: subscription.endpoint,
        keys: subscription.keys
      });
      await device.save();
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Push subscribe error:', error);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// Unsubscribe from push notifications
router.post('/unsubscribe', async (req, res) => {
  try {
    const { endpoint, deviceId } = req.body;
    const targetDeviceId = deviceId || 'ESP32_001';
    
    const device = await Device.findOne({ deviceId: targetDeviceId });
    if (device && device.pushSubscriptions) {
      device.pushSubscriptions = device.pushSubscriptions.filter(
        s => s.endpoint !== endpoint
      );
      await device.save();
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

module.exports = router;
