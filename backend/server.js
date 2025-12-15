require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const expressWs = require('express-ws');

const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/device');
const pushRoutes = require('./routes/push');
const { configurePush } = require('./utils/push');

const app = express();
const wsInstance = expressWs(app);

// Middleware
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());

// Serve static frontend files
const webMongoPath = path.resolve(__dirname, '../web-mongo');
console.log('Serving static files from:', webMongoPath);
app.use(express.static(webMongoPath));

// Configure push notifications
configurePush();

// Store WebSocket server reference
app.set('wss', wsInstance.getWss());

// WebSocket endpoint for real-time updates
app.ws('/ws/:deviceId', (ws, req) => {
  const { deviceId } = req.params;
  const isDevice = req.query.type === 'device';
  
  ws.deviceId = deviceId;
  ws.isDevice = isDevice;
  ws.isAlive = true;

  console.log(`WebSocket connected: ${deviceId} (${isDevice ? 'device' : 'client'})`);

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', async (msg) => {
    try {
      const data = JSON.parse(msg);
      
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      // Handle device data updates via WebSocket
      if (isDevice && data.type === 'data') {
        const Device = require('./models/Device');
        const AlarmHistory = require('./models/AlarmHistory');
        const { sendPushNotification } = require('./utils/push');

        let device = await Device.findOne({ deviceId });
        if (!device) {
          device = new Device({ deviceId });
        }

        const wasAlarm = device.current?.alarm;
        const isAlarm = data.data.alarm;

        device.current = {
          ...device.current,
          ...data.data,
          timestamp: new Date().toLocaleString()
        };
        device.lastSeen = new Date();
        await device.save();

        // Alarm triggered - save history and send push
        if (!wasAlarm && isAlarm) {
          const trigger = data.data.gas > (data.data.threshold || 40) && data.data.temperature > (data.data.tempThreshold || 60)
            ? 'both'
            : data.data.gas > (data.data.threshold || 40) ? 'gas' : 'temperature';

          await AlarmHistory.create({
            deviceId,
            trigger,
            gas: data.data.gas,
            temperature: data.data.temperature,
            humidity: data.data.humidity,
            timestamp: new Date().toLocaleString()
          });

          await sendPushNotification(deviceId, {
            title: '🔥 FIRE ALARM!',
            body: `${trigger === 'gas' ? 'Gas detected' : trigger === 'temperature' ? 'High temperature' : 'Gas + High temp'}`,
            vibrate: [200, 100, 200],
            tag: 'fire-alarm',
            requireInteraction: true
          });
        }

        // Broadcast to web clients
        wsInstance.getWss().clients.forEach(client => {
          if (client.deviceId === deviceId && !client.isDevice && client.readyState === 1) {
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

// Heartbeat to keep connections alive
setInterval(() => {
  wsInstance.getWss().clients.forEach(ws => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/device', deviceRoutes);
app.use('/api/push', pushRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend for all non-API routes (SPA support)
app.get('*', (req, res) => {
  // Skip API and WebSocket routes
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
    return res.status(404).json({ error: 'Not found' });
  }
  const indexPath = path.resolve(__dirname, '../web-mongo/index.html');
  console.log('Serving index.html from:', indexPath);
  res.sendFile(indexPath);
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
