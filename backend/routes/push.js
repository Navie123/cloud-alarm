const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { auth } = require('../middleware/auth');

// Get VAPID public key
router.get('/vapid-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// Subscribe to push notifications
router.post('/subscribe', auth, async (req, res) => {
  try {
    const { subscription } = req.body;
    
    // Check if subscription already exists
    const existingSub = req.user.pushSubscriptions.find(
      s => s.endpoint === subscription.endpoint
    );
    
    if (!existingSub) {
      req.user.pushSubscriptions.push({
        endpoint: subscription.endpoint,
        keys: subscription.keys
      });
      await req.user.save();
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Push subscribe error:', error);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// Unsubscribe from push notifications
router.post('/unsubscribe', auth, async (req, res) => {
  try {
    const { endpoint } = req.body;
    
    req.user.pushSubscriptions = req.user.pushSubscriptions.filter(
      s => s.endpoint !== endpoint
    );
    await req.user.save();
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

module.exports = router;
