// FireWire - Configuration
const CONFIG = {
  // Backend API URL - same origin since frontend is served by backend
  API_URL: '',  // Empty = same origin
  
  // WebSocket URL - auto-detect based on current host and protocol
  WS_URL: `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`,
  
  // Device ID - change this to match your ESP32
  DEVICE_ID: 'ESP32_001',
  
  // Google OAuth Client ID
  GOOGLE_CLIENT_ID: '54342700040-h5v20qtu9pfehik2r8t0q2snbi4699db.apps.googleusercontent.com'
};
