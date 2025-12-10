// ESP32 Simulator - Sends fake sensor data every second
const http = require('http');

const DEVICE_ID = 'ESP32_001';
const API_HOST = 'localhost';
const API_PORT = 3000;
const INTERVAL = 1000; // 1 second

// Base values (simulating a normal room)
let gasBase = 5;
let tempBase = 27;
let humidityBase = 60;

// Simulate gradual changes
let gasOffset = 0;
let tempOffset = 0;
let humOffset = 0;

function sendData() {
  // Add small random variations
  gasOffset += (Math.random() - 0.5) * 2;
  tempOffset += (Math.random() - 0.5) * 0.5;
  humOffset += (Math.random() - 0.5) * 1;

  // Keep offsets bounded
  gasOffset = Math.max(-3, Math.min(10, gasOffset));
  tempOffset = Math.max(-2, Math.min(5, tempOffset));
  humOffset = Math.max(-5, Math.min(10, humOffset));

  const gas = Math.max(0, gasBase + gasOffset);
  const temperature = tempBase + tempOffset;
  const humidity = Math.max(30, Math.min(90, humidityBase + humOffset));

  // Check if alarm should trigger
  const alarm = gas > 40 || temperature > 60;

  const data = JSON.stringify({
    gas: parseFloat(gas.toFixed(1)),
    temperature: parseFloat(temperature.toFixed(1)),
    humidity: parseFloat(humidity.toFixed(1)),
    voltage: parseFloat((3.2 + Math.random() * 0.2).toFixed(2)),
    threshold: 40,
    tempThreshold: 60,
    alarm: alarm,
    tempWarning: temperature > 55 ? 'warning' : temperature > 50 ? 'high' : 'normal',
    sirenEnabled: true,
    heap: Math.floor(240000 + Math.random() * 10000)
  });

  const options = {
    hostname: API_HOST,
    port: API_PORT,
    path: `/api/device/${DEVICE_ID}/data`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const req = http.request(options, (res) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] Gas: ${gas.toFixed(1)}% | Temp: ${temperature.toFixed(1)}°C | Humidity: ${humidity.toFixed(1)}%`);
  });

  req.on('error', (e) => {
    console.error('Error:', e.message);
  });

  req.write(data);
  req.end();
}

console.log('🔥 ESP32 Simulator Started');
console.log(`Sending data to http://${API_HOST}:${API_PORT}/api/device/${DEVICE_ID}/data`);
console.log('Press Ctrl+C to stop\n');

// Send immediately, then every second
sendData();
setInterval(sendData, INTERVAL);
