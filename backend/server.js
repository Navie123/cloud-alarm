require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const expressWs = require('express-ws');

const deviceRoutes = require('./routes/device');
const pushRoutes = require('./routes/push');
const { router: householdRoutes } = require('./routes/household');
const { configurePush } = require('./utils/push');
const Household = require('./models/Household');

const app = express();
const wsInstance = expressWs(app);

// Middleware
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// Serve static frontend files
const webMongoPath = path.resolve(__dirname, '../web-mongo');
console.log('Serving static files from:', webMongoPath);
app.use(express.static(webMongoPath));

// Configure push notifications
configurePush();

// Store WebSocket server reference
app.set('wss', wsInstance.getWss());

// WebSocket endpoint with household authentication
app.ws('/ws/:deviceId', async (ws, req) => {
  const { deviceId } = req.params;
  const { type, token, secret } = req.query;
  
  ws.deviceId = deviceId;
  ws.isDevice = type === 'device';
  ws.isAlive = true;
  ws.authenticated = false;

  // Authenticate connection
  if (ws.isDevice) {
    // ESP32 device authentication
    const household = await Household.findOne({
      'devices.deviceId': deviceId,
      'devices.deviceSecret': secret
    });
    if (!household) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid device credentials' }));
      ws.close();
      return;
    }
    ws.authenticated = true;
    ws.householdId = household.householdId;
    console.log(`[ESP32] Device ${deviceId} authenticated`);
  } else {
    // Web client authentication
    if (!token) {
      ws.send(JSON.stringify({ type: 'error', message: 'Session token required' }));
      ws.close();
      return;
    }
    const household = await Household.findOne({ 'sessions.token': token });
    if (!household) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid session' }));
      ws.close();
      return;
    }
    const session = household.verifySession(token);
    if (!session) {
      ws.send(JSON.stringify({ type: 'error', message: 'Session expired' }));
      ws.close();
      return;
    }
    // Verify device belongs to household
    if (!household.devices.find(d => d.deviceId === deviceId)) {
      ws.send(JSON.stringify({ type: 'error', message: 'Device not in household' }));
      ws.close();
      return;
    }
    ws.authenticated = true;
    ws.householdId = household.householdId;
    ws.isAdmin = session.isAdmin;
    ws.memberId = session.memberId;
    console.log(`[Client] Connected to ${deviceId} (admin: ${session.isAdmin})`);
  }

  ws.send(JSON.stringify({ type: 'connected', deviceId }));

  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', async (msg) => {
    if (!ws.authenticated) return;
    
    try {
      const data = JSON.parse(msg);
      
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      // Handle device data updates
      if (ws.isDevice && data.type === 'data') {
        const Device = require('./models/Device');
        const AlarmHistory = require('./models/AlarmHistory');
        const { sendPushNotification } = require('./utils/push');

        let device = await Device.findOne({ deviceId });
        if (!device) device = new Device({ deviceId });

        const wasAlarm = device.current?.alarm;
        const isAlarm = data.data.alarm;

        device.current = { ...device.current, ...data.data, timestamp: new Date().toLocaleString() };
        device.lastSeen = new Date();
        await device.save();

        // Alarm triggered
        if (!wasAlarm && isAlarm) {
          const trigger = data.data.gas > (data.data.threshold || 40) && data.data.temperature > (data.data.tempThreshold || 60)
            ? 'both' : data.data.gas > (data.data.threshold || 40) ? 'gas' : 'temperature';

          await AlarmHistory.create({
            deviceId, trigger,
            gas: data.data.gas,
            temperature: data.data.temperature,
            humidity: data.data.humidity,
            timestamp: new Date().toLocaleString()
          });

          await sendPushNotification(deviceId, {
            title: '🔥 FIRE ALARM!',
            body: `${trigger === 'gas' ? 'Gas detected' : trigger === 'temperature' ? 'High temperature' : 'Gas + High temp'}`,
            vibrate: [200, 100, 200], tag: 'fire-alarm', requireInteraction: true
          });
        }

        // Broadcast to authenticated web clients in same household
        wsInstance.getWss().clients.forEach(client => {
          if (client.deviceId === deviceId && !client.isDevice && 
              client.authenticated && client.householdId === ws.householdId && 
              client.readyState === 1) {
            client.send(JSON.stringify({ type: 'data', data: device.current }));
          }
        });
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    console.log(`WebSocket disconnected: ${deviceId}`);
  });
});

// Heartbeat
setInterval(() => {
  wsInstance.getWss().clients.forEach(ws => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// Routes
app.use('/api/household', householdRoutes);
app.use('/api/device', deviceRoutes);
app.use('/api/push', pushRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Reset database (DEV ONLY - remove in production)
app.post('/api/reset-db', async (req, res) => {
  try {
    await Household.collection.drop().catch(() => {});
    await Household.collection.dropIndexes().catch(() => {});
    res.json({ success: true, message: 'Database reset' });
  } catch (error) {
    res.json({ success: true, message: 'Reset attempted' });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.resolve(__dirname, '../web-mongo/index.html'));
});

// Connect to MongoDB and start server
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB Atlas');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
