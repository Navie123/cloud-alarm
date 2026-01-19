// FireWire Dashboard - Main Application (MongoDB Version)

const { jsPDF } = window.jspdf;

let sirenEnabled = true;
let currentThreshold = 40;
let currentTempThreshold = 60;
let isConnected = false;
let audioEnabled = false;
let alarmAudio = null;
let isPlaying = false;
let historyData = [];
let selectedAlarmSound = localStorage.getItem('alarmSound') || '911.mp3';
let previewAudio = null;
let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

// Track slider interaction
let sliderActive = false;
let tempSliderActive = false;
let smokeSliderActive = false;

// Track if we've received real-time data from ESP32 (not just database)
let hasReceivedRealtimeData = false;

// DOM Elements
const elements = {
  gasBar: document.getElementById('gasBar'),
  gasVal: document.getElementById('gasVal'),
  tempBar: document.getElementById('tempBar'),
  tempVal: document.getElementById('tempVal'),
  humBar: document.getElementById('humBar'),
  humVal: document.getElementById('humVal'),
  voltVal: document.getElementById('voltVal'),
  threshVal: document.getElementById('threshVal'),
  alarmCount: document.getElementById('alarmCount'),
  deviceStatus: document.getElementById('deviceStatus'),
  alarmCard: document.getElementById('alarmCard'),
  alarmIcon: document.getElementById('alarmIcon'),
  alarmText: document.getElementById('alarmText'),
  status: document.getElementById('status'),
  connectionBanner: document.getElementById('connectionBanner'),
  sirenOverlay: document.getElementById('sirenOverlay'),
  historyList: document.getElementById('historyList'),
  historyCount: document.getElementById('historyCount'),
  thresholdSlider: document.getElementById('thresholdSlider'),
  sliderValue: document.getElementById('sliderValue'),
  tempThresholdSlider: document.getElementById('tempThresholdSlider'),
  tempSliderValue: document.getElementById('tempSliderValue'),
  tempThreshVal: document.getElementById('tempThreshVal'),
  smokeThresholdSlider: document.getElementById('smokeThresholdSlider'),
  smokeSliderValue: document.getElementById('smokeSliderValue'),
  sirenIcon: document.getElementById('sirenIcon'),
  sirenText: document.getElementById('sirenText'),
  deviceId: document.getElementById('deviceId'),
  lastUpdate: document.getElementById('lastUpdate'),
  connectionStatus: document.getElementById('connectionStatus')
};

// Initialize - wait for auth
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupSlider();
  setupDateTime();
  setupRippleEffect();
});

// ============ RIPPLE EFFECT ============
function setupRippleEffect() {
  document.querySelectorAll('.btn, .action-btn, .tab, .sound-option, .notif-toggle').forEach(element => {
    element.classList.add('ripple');
    element.addEventListener('click', createRipple);
  });
}

function createRipple(event) {
  const element = event.currentTarget;
  const rect = element.getBoundingClientRect();
  const ripple = document.createElement('span');
  
  const size = Math.max(rect.width, rect.height);
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;
  
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = x + 'px';
  ripple.style.top = y + 'px';
  ripple.classList.add('ripple-effect');
  
  // Remove existing ripples
  const existingRipple = element.querySelector('.ripple-effect');
  if (existingRipple) existingRipple.remove();
  
  element.appendChild(ripple);
  
  // Remove after animation
  setTimeout(() => ripple.remove(), 600);
}

// Called after successful household access
function initializeApp() {
  loadAlarmSoundSetting();
  loadMemberPreferences();
  initPushNotifications();
  initEmailAlerts();
  connectWebSocket();
  loadInitialData();
  loadHistory();
  startHistoryAutoRefresh();
  startDeviceStatusChecker();
  setupAllThresholdSliders();
  loadCalibrationStatus();
}

// Setup all threshold sliders with dynamic colors
function setupAllThresholdSliders() {
  // Gas threshold slider
  const gasSlider = document.getElementById('thresholdSlider');
  const gasValue = document.getElementById('sliderValue');
  if (gasSlider && gasValue) {
    updateThresholdBadge(gasSlider, gasValue, 'gas');
    gasSlider.addEventListener('input', () => updateThresholdBadge(gasSlider, gasValue, 'gas'));
  }
  
  // Smoke threshold slider
  const smokeSlider = document.getElementById('smokeThresholdSlider');
  const smokeValue = document.getElementById('smokeSliderValue');
  if (smokeSlider && smokeValue) {
    updateThresholdBadge(smokeSlider, smokeValue, 'smoke');
    smokeSlider.addEventListener('input', () => updateThresholdBadge(smokeSlider, smokeValue, 'smoke'));
  }
  
  // Temperature threshold slider
  const tempSlider = document.getElementById('tempThresholdSlider');
  const tempValue = document.getElementById('tempSliderValue');
  if (tempSlider && tempValue) {
    updateThresholdBadge(tempSlider, tempValue, 'temp');
    tempSlider.addEventListener('input', () => updateThresholdBadge(tempSlider, tempValue, 'temp'));
  }
  
  // CO threshold sliders
  setupCOSliders();
}

function updateThresholdBadge(slider, badge, type) {
  const value = parseInt(slider.value);
  const levels = ['level-safe', 'level-low', 'level-medium', 'level-high', 'level-danger', 'level-critical'];
  
  // Remove all level classes
  levels.forEach(l => badge.classList.remove(l));
  
  let level;
  if (type === 'gas' || type === 'smoke') {
    badge.textContent = value + '%';
    if (value <= 20) level = 'level-safe';
    else if (value <= 35) level = 'level-low';
    else if (value <= 50) level = 'level-medium';
    else if (value <= 70) level = 'level-high';
    else if (value <= 85) level = 'level-danger';
    else level = 'level-critical';
  } else if (type === 'temp') {
    badge.textContent = value + '°C';
    if (value <= 45) level = 'level-safe';
    else if (value <= 52) level = 'level-low';
    else if (value <= 60) level = 'level-medium';
    else if (value <= 68) level = 'level-high';
    else if (value <= 75) level = 'level-danger';
    else level = 'level-critical';
  }
  
  badge.classList.add(level);
}

// Setup CO threshold sliders with dynamic colors
function setupCOSliders() {
  const coWarningSlider = document.getElementById('coWarningSlider');
  const coDangerSlider = document.getElementById('coDangerSlider');
  const coCriticalSlider = document.getElementById('coCriticalSlider');
  
  if (coWarningSlider) {
    updateCOSliderValue('coWarningSlider', 'coWarningVal');
    coWarningSlider.addEventListener('input', () => updateCOSliderValue('coWarningSlider', 'coWarningVal'));
  }
  
  if (coDangerSlider) {
    updateCOSliderValue('coDangerSlider', 'coDangerVal');
    coDangerSlider.addEventListener('input', () => updateCOSliderValue('coDangerSlider', 'coDangerVal'));
  }
  
  if (coCriticalSlider) {
    updateCOSliderValue('coCriticalSlider', 'coCriticalVal');
    coCriticalSlider.addEventListener('input', () => updateCOSliderValue('coCriticalSlider', 'coCriticalVal'));
  }
}

function updateCOSliderValue(sliderId, valueId) {
  const slider = document.getElementById(sliderId);
  const valueEl = document.getElementById(valueId);
  if (!slider || !valueEl) return;
  
  const value = parseInt(slider.value);
  valueEl.textContent = value + ' PPM';
}

// Track last data received time
let lastDataReceivedTime = null;

// Check device status periodically
function startDeviceStatusChecker() {
  setInterval(() => {
    const deviceStatus = document.getElementById('deviceStatus');
    const lastSeen = document.getElementById('lastSeen');
    
    if (lastDataReceivedTime) {
      const diffSeconds = (Date.now() - lastDataReceivedTime) / 1000;
      const isOnline = diffSeconds < 30;
      
      if (deviceStatus) {
        deviceStatus.textContent = isOnline ? 'Online' : 'Offline';
        deviceStatus.classList.toggle('online', isOnline);
        deviceStatus.classList.toggle('offline', !isOnline);
      }
      
      if (lastSeen) {
        if (diffSeconds < 10) {
          lastSeen.textContent = 'Just now';
        } else if (diffSeconds < 60) {
          lastSeen.textContent = Math.floor(diffSeconds) + 's ago';
        } else if (diffSeconds < 3600) {
          lastSeen.textContent = Math.floor(diffSeconds / 60) + 'm ago';
        } else {
          lastSeen.textContent = Math.floor(diffSeconds / 3600) + 'h ago';
        }
      }
    }
  }, 5000); // Check every 5 seconds
}

// ============ WebSocket Connection ============
let pingInterval = null;

function connectWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  const token = localStorage.getItem('householdToken');
  const deviceId = localStorage.getItem('deviceId') || CONFIG.DEVICE_ID;
  
  if (!token) {
    console.log('No token, skipping WebSocket');
    return;
  }

  const wsUrl = `${CONFIG.WS_URL}/ws/${deviceId}?token=${token}`;
  ws = new WebSocket(wsUrl);
  window.ws = ws;

  ws.onopen = () => {
    console.log('WebSocket connected');
    setConnected(true);
    reconnectAttempts = 0;
    
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === 'data') {
        updateUI(message.data, true); // true = real-time update from ESP32
      } else if (message.type === 'thresholds') {
        updateCOThresholds(message.data);
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
    setConnected(false);
    hasReceivedRealtimeData = false; // Reset real-time data flag
    
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
      reconnectAttempts++;
      setTimeout(connectWebSocket, delay);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

async function loadInitialData() {
  try {
    const device = await api.getDevice(CONFIG.DEVICE_ID);
    if (device && device.current) {
      updateUI(device.current);
    }
    // Also load CO thresholds from device.commands
    if (device && device.commands) {
      updateCOThresholds(device.commands);
    }
  } catch (error) {
    console.error('Failed to load initial data:', error);
  }
}

// Update CO threshold sliders from server data
function updateCOThresholds(commands) {
  const coWarningSlider = document.getElementById('coWarningSlider');
  const coDangerSlider = document.getElementById('coDangerSlider');
  const coCriticalSlider = document.getElementById('coCriticalSlider');
  
  if (coWarningSlider && commands.coWarningThreshold !== undefined) {
    coWarningSlider.value = commands.coWarningThreshold;
    updateCOSliderValue('coWarningSlider', 'coWarningVal');
  }
  if (coDangerSlider && commands.coDangerThreshold !== undefined) {
    coDangerSlider.value = commands.coDangerThreshold;
    updateCOSliderValue('coDangerSlider', 'coDangerVal');
  }
  if (coCriticalSlider && commands.coCriticalThreshold !== undefined) {
    coCriticalSlider.value = commands.coCriticalThreshold;
    updateCOSliderValue('coCriticalSlider', 'coCriticalVal');
  }
}

// ============ Audio Functions ============
function enableAudio() {
  alarmAudio = new Audio(selectedAlarmSound);
  alarmAudio.loop = false;
  alarmAudio.volume = 1.0;
  alarmAudio.preload = 'auto';
  alarmAudio.load();
  
  alarmAudio.onended = function() {
    isPlaying = false;
    if (document.body.classList.contains('alarm-mode') && sirenEnabled && audioEnabled) {
      setTimeout(() => playAlarmSound(), 500);
    }
  };
  
  audioEnabled = true;
  document.getElementById('audioPrompt').classList.add('hidden');
}

function playAlarmSound() {
  if (!sirenEnabled || !audioEnabled || isPlaying) return;
  if (!alarmAudio || alarmAudio.src !== location.origin + '/' + selectedAlarmSound) {
    alarmAudio = new Audio(selectedAlarmSound);
    alarmAudio.loop = false;
    alarmAudio.volume = 1.0;
    alarmAudio.onended = function() {
      isPlaying = false;
      if (document.body.classList.contains('alarm-mode') && sirenEnabled && audioEnabled) {
        setTimeout(() => playAlarmSound(), 500);
      }
    };
  }
  isPlaying = true;
  alarmAudio.currentTime = 0;
  alarmAudio.play().catch(e => {
    console.log('Play error:', e);
    isPlaying = false;
  });
}

function stopAlarmSound() {
  if (!alarmAudio) return;
  alarmAudio.pause();
  alarmAudio.currentTime = 0;
  isPlaying = false;
}

// ============ Sidebar Functions ============
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('show');
  document.body.classList.toggle('sidebar-open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
  document.body.classList.remove('sidebar-open');
}

// Tab Navigation
function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
  });
}

// Color levels
function getGasLevel(value) {
  if (value <= 20) return 'level-safe';
  if (value <= 35) return 'level-low';
  if (value <= 50) return 'level-medium';
  if (value <= 70) return 'level-high';
  if (value <= 85) return 'level-danger';
  return 'level-critical';
}

function getTempLevel(value) {
  if (value <= 45) return 'level-safe';
  if (value <= 52) return 'level-low';
  if (value <= 60) return 'level-medium';
  if (value <= 68) return 'level-high';
  if (value <= 75) return 'level-danger';
  return 'level-critical';
}

function updateSliderColors(slider, valueDisplay, level) {
  const levels = ['level-safe', 'level-low', 'level-medium', 'level-high', 'level-danger', 'level-critical'];
  levels.forEach(l => {
    slider.classList.remove(l);
    valueDisplay.classList.remove(l);
  });
  slider.classList.add(level);
  valueDisplay.classList.add(level);
}

function setupSlider() {
  const setupGasSlider = (slider, valueEl) => {
    if (!slider) return;
    
    slider.addEventListener('mousedown', () => { sliderActive = true; });
    slider.addEventListener('touchstart', () => { sliderActive = true; });
    slider.addEventListener('mouseup', () => { sliderActive = false; });
    slider.addEventListener('touchend', () => { sliderActive = false; });
    
    slider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      const level = getGasLevel(value);
      
      elements.sliderValue.textContent = value + '%';
      updateSliderColors(elements.thresholdSlider, elements.sliderValue, level);
      
      const sideSlider = document.getElementById('sliderSide');
      const sideVal = document.getElementById('sliderValSide');
      if (sideSlider && sideSlider !== slider) sideSlider.value = value;
      if (sideVal) {
        sideVal.textContent = value + '%';
        if (sideSlider) updateSliderColors(sideSlider, sideVal, level);
      }
      if (elements.thresholdSlider !== slider) elements.thresholdSlider.value = value;
    });
  };
  
  setupGasSlider(elements.thresholdSlider, elements.sliderValue);
  setupGasSlider(document.getElementById('sliderSide'), document.getElementById('sliderValSide'));
  
  const setupTempSlider = (slider, valueEl) => {
    if (!slider) return;
    
    slider.addEventListener('mousedown', () => { tempSliderActive = true; });
    slider.addEventListener('touchstart', () => { tempSliderActive = true; });
    slider.addEventListener('mouseup', () => { tempSliderActive = false; });
    slider.addEventListener('touchend', () => { tempSliderActive = false; });
    
    slider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      const level = getTempLevel(value);
      
      elements.tempSliderValue.textContent = value + '°C';
      updateSliderColors(elements.tempThresholdSlider, elements.tempSliderValue, level);
    });
  };
  
  setupTempSlider(elements.tempThresholdSlider, elements.tempSliderValue);
  
  // Setup smoke threshold slider
  const setupSmokeSlider = (slider, valueEl) => {
    if (!slider) return;
    
    slider.addEventListener('mousedown', () => { smokeSliderActive = true; });
    slider.addEventListener('touchstart', () => { smokeSliderActive = true; });
    slider.addEventListener('mouseup', () => { smokeSliderActive = false; });
    slider.addEventListener('touchend', () => { smokeSliderActive = false; });
    
    slider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      const level = getGasLevel(value);
      
      if (elements.smokeSliderValue) {
        elements.smokeSliderValue.textContent = value + '%';
        updateSliderColors(slider, elements.smokeSliderValue, level);
      }
    });
  };
  
  setupSmokeSlider(elements.smokeThresholdSlider, elements.smokeSliderValue);
}

function setupDateTime() {
  function update() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const hour12 = hours % 12 || 12;
    const period = hours >= 12 ? 'PM' : 'AM';
    
    // Update time display
    const timeEl = document.getElementById('currentTime');
    const periodEl = document.getElementById('timePeriod');
    const dayEl = document.getElementById('currentDay');
    const dateEl = document.getElementById('currentDate');
    
    if (timeEl) timeEl.textContent = `${hour12}:${minutes}`;
    if (periodEl) periodEl.textContent = period;
    
    // Update day name (e.g., "Tuesday")
    if (dayEl) {
      const dayOptions = { weekday: 'long' };
      dayEl.textContent = now.toLocaleDateString('en-US', dayOptions);
    }
    
    // Update date (e.g., "Dec 16")
    if (dateEl) {
      const dateOptions = { month: 'short', day: 'numeric' };
      dateEl.textContent = now.toLocaleDateString('en-US', dateOptions);
    }
    
    // Update greeting based on time of day
    updateGreeting(hours);
  }
  update();
  setInterval(update, 1000);
}

function updateGreeting(hours) {
  const greetEl = document.getElementById('greetText');
  const subEl = document.getElementById('greetSub');
  const weatherIcon = document.getElementById('weatherIcon');
  
  // Get user's name from localStorage or auth
  const memberName = localStorage.getItem('memberName') || '';
  const userName = memberName ? `, ${memberName}` : '';
  
  let greeting, iconClass, timeClass;
  
  if (hours >= 5 && hours < 12) {
    greeting = `Good Morning${userName}!`;
    iconClass = 'fa-sun';
    timeClass = 'morning';
  } else if (hours >= 12 && hours < 17) {
    greeting = `Good Afternoon${userName}!`;
    iconClass = 'fa-cloud-sun';
    timeClass = 'afternoon';
  } else if (hours >= 17 && hours < 21) {
    greeting = `Good Evening${userName}!`;
    iconClass = 'fa-cloud-moon';
    timeClass = 'evening';
  } else {
    greeting = `Good Evening${userName}!`;
    iconClass = 'fa-moon';
    timeClass = 'night';
  }
  
  if (greetEl) greetEl.textContent = greeting;
  if (subEl) subEl.style.display = 'none'; // Hide subtitle
  if (weatherIcon) {
    weatherIcon.className = 'weather-icon ' + timeClass;
    weatherIcon.innerHTML = `<i class="fas ${iconClass}"></i>`;
  }
}

// Update UI with sensor data
function updateUI(data, isRealtimeUpdate = false) {
  if (!data) return;
  
  // Only track lastDataReceivedTime for real-time WebSocket updates, not database loads
  if (isRealtimeUpdate) {
    lastDataReceivedTime = Date.now();
    hasReceivedRealtimeData = true;
  }
  
  // Determine if device is online
  // Device is ONLY online if:
  // 1. WebSocket is connected AND
  // 2. We have received real-time data from ESP32
  let isDeviceOnline = isConnected && hasReceivedRealtimeData;
  let diffSeconds = Infinity;
  
  // Calculate time since last data for display
  if (lastDataReceivedTime && hasReceivedRealtimeData) {
    diffSeconds = (Date.now() - lastDataReceivedTime) / 1000;
  } else if (data.lastSeen) {
    // Use database lastSeen for display only (not for online status)
    const lastSeenTime = new Date(data.lastSeen).getTime();
    diffSeconds = (Date.now() - lastSeenTime) / 1000;
  }
  
  // If WebSocket is not connected, device is definitely offline
  if (!isConnected) {
    isDeviceOnline = false;
  }
  
  // Update last seen display
  const lastSeen = document.getElementById('lastSeen');
  if (lastSeen) {
    if (!isFinite(diffSeconds) || diffSeconds === Infinity) {
      lastSeen.textContent = '--';
    } else if (diffSeconds < 10) {
      lastSeen.textContent = 'Just now';
    } else if (diffSeconds < 60) {
      lastSeen.textContent = Math.floor(diffSeconds) + 's ago';
    } else if (diffSeconds < 3600) {
      lastSeen.textContent = Math.floor(diffSeconds / 60) + 'm ago';
    } else if (diffSeconds < 86400) {
      lastSeen.textContent = Math.floor(diffSeconds / 3600) + 'h ago';
    } else {
      lastSeen.textContent = Math.floor(diffSeconds / 86400) + 'd ago';
    }
  }
  
  // Update device status displays
  const deviceStatus = document.getElementById('deviceStatus');
  const connectionStatus = document.getElementById('connectionStatus');
  
  if (deviceStatus) {
    deviceStatus.textContent = isDeviceOnline ? 'Online' : 'Offline';
    deviceStatus.classList.toggle('online', isDeviceOnline);
    deviceStatus.classList.toggle('offline', !isDeviceOnline);
  }
  
  if (connectionStatus) {
    connectionStatus.textContent = isDeviceOnline ? 'Connected' : 'Disconnected';
  }
  
  // Update sensor values only if device is online, otherwise show "--"
  if (isDeviceOnline) {
    // Gas gauge update (MQ-7)
    const gasPercent = Math.min(data.gas || 0, 100);
    const gasVal = document.getElementById('gasVal');
    if (gasVal) gasVal.textContent = gasPercent.toFixed(1);
    updateGauge('gasGauge', gasPercent, 100);
    
    // Smoke gauge update (MQ-2)
    const smokePercent = Math.min(data.smoke || 0, 100);
    const smokeVal = document.getElementById('smokeVal');
    if (smokeVal) smokeVal.textContent = smokePercent.toFixed(1);
    updateGauge('smokeGauge', smokePercent, 100);
    
    // Temperature gauge update
    const temp = data.temperature || 0;
    const tempVal = document.getElementById('tempVal');
    if (tempVal) tempVal.textContent = temp.toFixed(1);
    updateGauge('tempGauge', temp, 80);
    
    // Humidity gauge update
    const humidity = Math.min(data.humidity || 0, 100);
    const humVal = document.getElementById('humVal');
    if (humVal) humVal.textContent = humidity.toFixed(1);
    updateGauge('humGauge', humidity, 100);
    
    // Humidity level text
    const humLevel = document.getElementById('humLevel');
    if (humLevel) {
      if (humidity < 30) humLevel.textContent = 'Low';
      else if (humidity < 60) humLevel.textContent = 'Normal';
      else humLevel.textContent = 'High';
    }
    
    // Voltage
    const voltVal = document.getElementById('voltVal');
    if (voltVal) voltVal.textContent = (data.voltage || 0).toFixed(2);
  } else {
    // Device is offline - show "--" for all sensor values
    const gasVal = document.getElementById('gasVal');
    const smokeVal = document.getElementById('smokeVal');
    const tempVal = document.getElementById('tempVal');
    const humVal = document.getElementById('humVal');
    const voltVal = document.getElementById('voltVal');
    const humLevel = document.getElementById('humLevel');
    
    if (gasVal) gasVal.textContent = '--';
    if (smokeVal) smokeVal.textContent = '--';
    if (tempVal) tempVal.textContent = '--';
    if (humVal) humVal.textContent = '--';
    if (voltVal) voltVal.textContent = '--';
    if (humLevel) humLevel.textContent = '--';
    
    // Reset gauges to 0
    updateGauge('gasGauge', 0, 100);
    updateGauge('smokeGauge', 0, 100);
    updateGauge('tempGauge', 0, 80);
    updateGauge('humGauge', 0, 100);
  }
  
  // Smoke status and card styling (always update for consistency)
  const smokeStatus = document.getElementById('smokeStatus');
  const smokeCard = document.querySelector('.smoke-card');
  if (smokeStatus) {
    if (isDeviceOnline) {
      const status = data.smokeStatus || 'normal';
      smokeStatus.textContent = status.charAt(0).toUpperCase() + status.slice(1);
      smokeStatus.className = 'status-value smoke-' + status;
    } else {
      smokeStatus.textContent = '--';
      smokeStatus.className = 'status-value';
    }
  }
  if (smokeCard) {
    smokeCard.classList.remove('status-warning', 'status-danger', 'status-critical');
    if (isDeviceOnline && data.smokeStatus === 'warning') smokeCard.classList.add('status-warning');
    else if (isDeviceOnline && data.smokeStatus === 'danger') smokeCard.classList.add('status-danger');
    else if (isDeviceOnline && data.smokeStatus === 'critical') smokeCard.classList.add('status-critical');
  }
  
  // Thresholds (always show these as they're settings, not sensor readings)
  const threshVal = document.getElementById('threshVal');
  if (threshVal) threshVal.textContent = data.threshold || '40';
  
  const tempThreshVal = document.getElementById('tempThreshVal');
  if (tempThreshVal) tempThreshVal.textContent = data.tempThreshold || '60';
  
  if (!sliderActive && elements.thresholdSlider) {
    currentThreshold = data.threshold || 40;
    elements.thresholdSlider.value = currentThreshold;
    if (elements.sliderValue) {
      elements.sliderValue.textContent = currentThreshold + '%';
      const gasLevel = getGasLevel(currentThreshold);
      updateSliderColors(elements.thresholdSlider, elements.sliderValue, gasLevel);
    }
  }
  
  if (!tempSliderActive && elements.tempThresholdSlider) {
    currentTempThreshold = data.tempThreshold || 60;
    elements.tempThresholdSlider.value = currentTempThreshold;
    if (elements.tempSliderValue) {
      elements.tempSliderValue.textContent = currentTempThreshold + '°C';
      const tempLevel = getTempLevel(currentTempThreshold);
      updateSliderColors(elements.tempThresholdSlider, elements.tempSliderValue, tempLevel);
    }
  }
  
  // Update smoke threshold slider from server data
  if (!smokeSliderActive && elements.smokeThresholdSlider) {
    const smokeThreshold = data.smokeThreshold || 40;
    elements.smokeThresholdSlider.value = smokeThreshold;
    if (elements.smokeSliderValue) {
      elements.smokeSliderValue.textContent = smokeThreshold + '%';
      const smokeLevel = getGasLevel(smokeThreshold);
      updateSliderColors(elements.smokeThresholdSlider, elements.smokeSliderValue, smokeLevel);
    }
  }
  
  sirenEnabled = data.sirenEnabled !== false;
  updateSirenUI();
  
  // Only show alarm if device is online
  if (isDeviceOnline) {
    updateAlarmState(data.alarm, data.tempWarning);
  } else {
    // Clear alarm state when offline
    updateAlarmState(false, false);
  }
  
  // Device info
  const deviceId = document.getElementById('deviceId');
  if (deviceId) deviceId.textContent = CONFIG.DEVICE_ID;
  
  const lastUpdate = document.getElementById('lastUpdate');
  if (lastUpdate) lastUpdate.textContent = data.timestamp || '--';
  
  // Update Device tab info (sync with Settings tab)
  const deviceIdDisplay = document.getElementById('deviceIdDisplay');
  if (deviceIdDisplay) deviceIdDisplay.textContent = CONFIG.DEVICE_ID;
  
  const lastUpdateDisplay = document.getElementById('lastUpdateDisplay');
  if (lastUpdateDisplay) lastUpdateDisplay.textContent = data.timestamp || '--';
  
  const freeHeapDisplay = document.getElementById('freeHeapDisplay');
  if (freeHeapDisplay && data.heap) {
    freeHeapDisplay.textContent = (data.heap / 1024).toFixed(1) + ' KB';
  }
  
  const connectionStatusDisplay = document.getElementById('connectionStatusDisplay');
  if (connectionStatusDisplay) {
    connectionStatusDisplay.textContent = isDeviceOnline ? 'Connected' : 'Disconnected';
  }
  
  // Update WiFi Configuration card info
  const currentWifiName = document.getElementById('currentWifiName');
  if (currentWifiName) {
    currentWifiName.textContent = isDeviceOnline ? (data.wifiSSID || '--') : '--';
  }
  
  const deviceUptime = document.getElementById('deviceUptime');
  if (deviceUptime) {
    if (isDeviceOnline && data.uptime !== undefined) {
      deviceUptime.textContent = formatUptime(data.uptime);
    } else {
      deviceUptime.textContent = '--';
    }
  }
  
  updateSidebarInfo(data);
}

// Format uptime in human readable format
function formatUptime(seconds) {
  if (!seconds || seconds < 0) return '--';
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (days > 0) {
    return `${days}d ${hours}h ${mins}m`;
  } else if (hours > 0) {
    return `${hours}h ${mins}m ${secs}s`;
  } else if (mins > 0) {
    return `${mins}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// Update circular gauge
function updateGauge(gaugeId, value, max) {
  const gauge = document.getElementById(gaugeId);
  if (!gauge) return;
  
  const circumference = 2 * Math.PI * 42; // r=42
  const percent = Math.min(value / max, 1);
  const offset = circumference * (1 - percent);
  gauge.style.strokeDashoffset = offset;
}

function updateAlarmState(isAlarm, tempWarning) {
  const alarmCard = document.getElementById('alarmCard');
  const alarmIcon = document.getElementById('alarmIcon');
  const alarmText = document.getElementById('alarmText');
  const alarmSubtitle = document.getElementById('alarmSubtitle');
  const sirenOverlay = document.getElementById('sirenOverlay');
  
  if (isAlarm) {
    if (alarmCard) alarmCard.classList.add('alarm-active');
    if (alarmIcon) alarmIcon.className = 'fas fa-triangle-exclamation';
    if (alarmText) alarmText.textContent = 'ALARM ACTIVE!';
    if (alarmSubtitle) alarmSubtitle.textContent = 'Danger detected - take action now!';
    if (sirenOverlay) sirenOverlay.classList.add('active');
    document.body.classList.add('alarm-mode');
    playAlarmSound();
  } else {
    if (alarmCard) alarmCard.classList.remove('alarm-active');
    if (alarmIcon) alarmIcon.className = 'fas fa-shield-check';
    if (alarmText) alarmText.textContent = 'System Normal';
    if (alarmSubtitle) alarmSubtitle.textContent = 'All sensors within safe range';
    if (sirenOverlay) sirenOverlay.classList.remove('active');
    document.body.classList.remove('alarm-mode');
    stopAlarmSound();
  }
}

function setConnected(connected) {
  isConnected = connected;
  const statusEl = document.getElementById('status');
  const connectionBanner = document.getElementById('connectionBanner');
  const deviceStatus = document.getElementById('deviceStatus');
  
  if (connected) {
    if (connectionBanner) connectionBanner.classList.remove('show');
    if (statusEl) {
      statusEl.innerHTML = '<i class="fas fa-check-circle"></i> Connected';
      statusEl.classList.add('connected');
      statusEl.classList.remove('disconnected');
    }
  } else {
    if (connectionBanner) connectionBanner.classList.add('show');
    if (statusEl) {
      statusEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> Disconnected';
      statusEl.classList.add('disconnected');
      statusEl.classList.remove('connected');
    }
    if (deviceStatus) {
      deviceStatus.textContent = 'Offline';
      deviceStatus.classList.remove('online');
      deviceStatus.classList.add('offline');
    }
  }
}

function updateSirenUI() {
  // Update Settings tab button
  if (elements.sirenIcon) elements.sirenIcon.className = sirenEnabled ? 'fas fa-bell' : 'fas fa-bell-slash';
  if (elements.sirenText) elements.sirenText.textContent = sirenEnabled ? 'Siren On' : 'Siren Off';
  
  // Update Sidebar button
  const sideIcon = document.getElementById('sirenIconSide');
  const sideText = document.getElementById('sirenTextSide');
  if (sideIcon) sideIcon.className = sirenEnabled ? 'fas fa-bell' : 'fas fa-bell-slash';
  if (sideText) sideText.textContent = sirenEnabled ? 'Siren On' : 'Siren Off';
  
  // Update Alerts tab button
  const alertIcon = document.getElementById('sirenIconAlert');
  const alertText = document.getElementById('sirenTextAlert');
  const sirenToggleBtn = document.getElementById('sirenToggleBtn');
  
  if (alertIcon) alertIcon.className = sirenEnabled ? 'fas fa-bell' : 'fas fa-bell-slash';
  if (alertText) alertText.textContent = sirenEnabled ? 'Siren On' : 'Siren Off';
  
  // Update button visual state
  if (sirenToggleBtn) {
    sirenToggleBtn.classList.remove('siren-on', 'siren-off');
    sirenToggleBtn.classList.add(sirenEnabled ? 'siren-on' : 'siren-off');
  }
  
  if (!sirenEnabled) stopAlarmSound();
}

let historyRefreshInterval = null;

async function loadHistory() {
  try {
    const history = await api.getHistory(CONFIG.DEVICE_ID);
    renderHistory(history);
  } catch (error) {
    console.error('Failed to load history:', error);
  }
}

function refreshHistory() {
  loadHistory();
  showToast('History refreshed');
}

// Start auto-refresh for history (every 30 seconds)
function startHistoryAutoRefresh() {
  if (historyRefreshInterval) clearInterval(historyRefreshInterval);
  historyRefreshInterval = setInterval(loadHistory, 30000);
}

function stopHistoryAutoRefresh() {
  if (historyRefreshInterval) {
    clearInterval(historyRefreshInterval);
    historyRefreshInterval = null;
  }
}

// Format timestamp to relative time
function formatTimeAgo(timestamp) {
  if (!timestamp) return '--';
  
  // Try to parse the timestamp
  let date;
  if (typeof timestamp === 'string') {
    // Handle various formats
    date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      // Try parsing as local format
      return timestamp; // Return as-is if can't parse
    }
  } else {
    date = new Date(timestamp);
  }
  
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  
  // Format as date for older entries
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function renderHistory(history) {
  historyData = history;
  
  const historyCount = document.getElementById('historyCount');
  const alarmCount = document.getElementById('alarmCount');
  const historyList = document.getElementById('historyList');
  
  if (historyCount) historyCount.textContent = history.length;
  if (alarmCount) alarmCount.textContent = history.length;
  
  if (!historyList) return;
  
  if (history.length === 0) {
    historyList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-check-circle"></i>
        <p>No alarm history</p>
      </div>`;
    return;
  }
  
  historyList.innerHTML = history.map((item, index) => {
    const timeAgo = formatTimeAgo(item.createdAt || item.timestamp);
    const fullTime = item.timestamp || new Date(item.createdAt).toLocaleString();
    
    return `
    <div class="history-item" style="animation-delay: ${index * 0.05}s">
      <div class="history-info">
        <span class="history-time" title="${fullTime}"><i class="fas fa-clock"></i> ${timeAgo}</span>
        <span class="history-trigger ${item.trigger}">${item.trigger?.toUpperCase() || 'ALARM'}</span>
      </div>
      <div class="history-values">
        <span><i class="fas fa-fire"></i> ${item.gas?.toFixed(1) || '--'}%</span>
        <span><i class="fas fa-temperature-half"></i> ${item.temperature?.toFixed(1) || '--'}°C</span>
      </div>
    </div>
  `}).join('');
}

// ============ Control Functions (Admin PIN Required) ============
function getDeviceId() {
  return localStorage.getItem('deviceId') || CONFIG.DEVICE_ID;
}

// Admin-only control functions
async function saveThreshold() {
  if (!isAdmin()) {
    showToast('Admin access required', 'error');
    return;
  }
  const value = parseInt(elements.thresholdSlider.value);
  try {
    await api.sendCommand(getDeviceId(), 'threshold', value);
    currentThreshold = value;
    showToast('Gas threshold saved: ' + value + '%');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function saveTempThreshold() {
  if (!isAdmin()) {
    showToast('Admin access required', 'error');
    return;
  }
  const value = parseInt(elements.tempThresholdSlider.value);
  try {
    await api.sendCommand(getDeviceId(), 'tempThreshold', value);
    currentTempThreshold = value;
    showToast('Temp threshold saved: ' + value + '°C');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function saveSmokeThreshold() {
  if (!isAdmin()) {
    showToast('Admin access required', 'error');
    return;
  }
  const slider = document.getElementById('smokeThresholdSlider');
  const value = parseInt(slider?.value || 40);
  try {
    await api.sendCommand(getDeviceId(), 'smokeThreshold', value);
    showToast('Smoke threshold saved: ' + value + '%');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function silenceAlarm() {
  if (!isAdmin()) {
    showToast('Admin access required', 'error');
    return;
  }
  stopAlarmSound();
  
  // Add visual feedback to button
  const silenceBtn = document.getElementById('silenceAlarmBtn');
  if (silenceBtn) {
    silenceBtn.classList.add('silenced');
    silenceBtn.innerHTML = '<i class="fas fa-check-circle"></i><span>Silenced</span>';
    
    // Reset after 3 seconds
    setTimeout(() => {
      silenceBtn.classList.remove('silenced');
      silenceBtn.innerHTML = '<i class="fas fa-volume-xmark"></i><span>Silence Alarm</span>';
    }, 3000);
  }
  
  try {
    await api.silenceAlarm(getDeviceId());
    showToast('Alarm silenced');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function toggleSiren() {
  if (!isAdmin()) {
    showToast('Admin access required', 'error');
    return;
  }
  const newState = !sirenEnabled;
  try {
    await api.sendCommand(getDeviceId(), 'sirenEnabled', newState);
    sirenEnabled = newState;
    updateSirenUI();
    showToast('Siren ' + (newState ? 'enabled' : 'disabled'));
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function clearHistory() {
  if (!isAdmin()) {
    showToast('Admin access required', 'error');
    return;
  }
  if (!confirm('Are you sure you want to clear all alarm history?')) return;
  
  try {
    await api.clearHistory(getDeviceId());
    historyData = [];
    renderHistory([]);
    showToast('History cleared');
  } catch (error) {
    showToast('Error clearing history', 'error');
  }
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i> ${message}`;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Format date to Philippines timezone (UTC+8)
function formatDatePH(dateInput) {
  if (!dateInput) return '--';
  
  let date;
  if (typeof dateInput === 'string') {
    date = new Date(dateInput);
  } else {
    date = new Date(dateInput);
  }
  
  if (isNaN(date.getTime())) return dateInput;
  
  // Format in Philippines timezone
  return date.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

function exportPDF() {
  if (!historyData || historyData.length === 0) {
    showToast('No history to export', 'error');
    return;
  }
  
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'legal' });
  const pageW = 356, pageH = 216;
  
  // Header
  doc.setFillColor(255, 87, 34);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  doc.text('FIREWIRE - SMART FIRE MONITORING', 15, 13);
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text('Alarm History Report', 15, 20);
  doc.text('Generated: ' + formatDatePH(new Date()), 15, 25);
  doc.text('By Vince Angelo Nailon', pageW - 60, 20);
  
  // Table header
  let y = 42;
  doc.setFillColor(245, 245, 245);
  doc.rect(15, y - 6, pageW - 30, 8, 'F');
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.setFont(undefined, 'bold');
  doc.text('#', 20, y);
  doc.text('Date & Time (PH)', 35, y);
  doc.text('Trigger', 120, y);
  doc.text('Gas Level', 155, y);
  doc.text('CO (PPM)', 195, y);
  doc.text('AQI', 235, y);
  doc.text('Temperature', 270, y);
  doc.text('Humidity', 310, y);
  
  y += 10;
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  
  historyData.forEach((h, i) => {
    if (y > pageH - 20) {
      doc.addPage();
      y = 20;
    }
    
    // Use createdAt for accurate time, fallback to timestamp
    const displayTime = formatDatePH(h.createdAt || h.timestamp);
    
    doc.setTextColor(40, 40, 40);
    doc.text(String(i + 1), 20, y);
    doc.text(displayTime, 35, y);
    doc.text((h.trigger || 'unknown').toUpperCase(), 120, y);
    doc.text((h.gas?.toFixed(1) || '--') + '%', 155, y);
    doc.text((h.coPpm?.toFixed(0) || '--'), 195, y);
    doc.text((h.aqi?.toFixed(0) || '--'), 235, y);
    doc.text((h.temperature?.toFixed(1) || '--') + '°C', 270, y);
    doc.text((h.humidity?.toFixed(1) || '--') + '%', 310, y);
    
    y += 9;
  });
  
  // Footer
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${totalPages}`, pageW - 30, pageH - 10);
    doc.text('FireWire © 2025', 15, pageH - 10);
  }
  
  const filename = 'FireWire_History_' + new Date().toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }).replace(/\//g, '-') + '.pdf';
  doc.save(filename);
  showToast('PDF exported successfully');
}

function updateSidebarInfo(data) {
  if (!sliderActive) {
    const sideSlider = document.getElementById('sliderSide');
    const sideVal = document.getElementById('sliderValSide');
    const gasThresh = data.threshold || 40;
    if (sideSlider) sideSlider.value = gasThresh;
    if (sideVal) sideVal.textContent = gasThresh + '%';
  }
  
  // Update sidebar system info
  const sidebarStatus = document.getElementById('sidebarStatus');
  const sidebarHeap = document.getElementById('sidebarHeap');
  const sidebarLastUpdate = document.getElementById('sidebarLastUpdate');
  const freeHeap = document.getElementById('freeHeap');
  
  if (sidebarStatus) sidebarStatus.textContent = isConnected ? 'Connected' : 'Disconnected';
  if (sidebarHeap) sidebarHeap.textContent = data.heap ? Math.round(data.heap / 1024) + ' KB' : '-- KB';
  if (sidebarLastUpdate) sidebarLastUpdate.textContent = data.timestamp || '--';
  if (freeHeap) freeHeap.textContent = data.heap ? Math.round(data.heap / 1024) + ' KB' : '--';
}

// ============ SMS Functions (Disabled - No Auth) ============
function saveSmsSettings() {
  showToast('SMS feature requires login system', 'error');
}

function testSms() {
  showToast('SMS feature requires login system', 'error');
}

// ============ Alarm Sound Functions ============
function previewSound(soundFile) {
  if (previewAudio) {
    previewAudio.pause();
    previewAudio.currentTime = 0;
  }
  previewAudio = new Audio(soundFile);
  previewAudio.volume = 0.5;
  previewAudio.play().catch(e => console.log('Preview error:', e));
  
  // Stop after 3 seconds
  setTimeout(() => {
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
    }
  }, 3000);
}

// Save alarm sound (personal preference - no admin required)
async function saveAlarmSound() {
  const selected = document.querySelector('input[name="alarmSound"]:checked');
  if (selected) {
    selectedAlarmSound = selected.value;
    localStorage.setItem('alarmSound', selectedAlarmSound);
    
    // Update the alarm audio
    if (alarmAudio) {
      alarmAudio.src = selectedAlarmSound;
      alarmAudio.load();
    }
    
    // Save to server for this member
    const memberId = getMemberId();
    if (memberId) {
      try {
        await api.updatePreferences(memberId, { alarmSound: selectedAlarmSound });
      } catch (e) {
        console.log('Could not save preference to server');
      }
    }
    
    showToast('Alarm sound saved: ' + selected.parentElement.querySelector('span').textContent.trim());
  }
}

function loadAlarmSoundSetting() {
  const saved = localStorage.getItem('alarmSound') || '911.mp3';
  selectedAlarmSound = saved;
  const radio = document.querySelector(`input[name="alarmSound"][value="${saved}"]`);
  if (radio) radio.checked = true;
}

// Load member preferences from server
async function loadMemberPreferences() {
  const memberId = getMemberId();
  if (!memberId) return;
  
  try {
    const prefs = await api.getPreferences(memberId);
    if (prefs.alarmSound) {
      selectedAlarmSound = prefs.alarmSound;
      localStorage.setItem('alarmSound', prefs.alarmSound);
      const radio = document.querySelector(`input[name="alarmSound"][value="${prefs.alarmSound}"]`);
      if (radio) radio.checked = true;
    }
  } catch (e) {
    console.log('Could not load preferences');
  }
}




// ============ Fullscreen Functions ============
let isFullscreen = false;

function toggleFullscreen() {
  const icon = document.getElementById('fullscreenIcon');
  
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    // Enter fullscreen
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    }
    isFullscreen = true;
    if (icon) icon.className = 'fas fa-compress';
    document.body.classList.add('fullscreen-mode');
  } else {
    // Exit fullscreen
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
    isFullscreen = false;
    if (icon) icon.className = 'fas fa-expand';
    document.body.classList.remove('fullscreen-mode');
  }
}

// Listen for fullscreen change events
document.addEventListener('fullscreenchange', updateFullscreenIcon);
document.addEventListener('webkitfullscreenchange', updateFullscreenIcon);

function updateFullscreenIcon() {
  const icon = document.getElementById('fullscreenIcon');
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    isFullscreen = true;
    if (icon) icon.className = 'fas fa-compress';
    document.body.classList.add('fullscreen-mode');
  } else {
    isFullscreen = false;
    if (icon) icon.className = 'fas fa-expand';
    document.body.classList.remove('fullscreen-mode');
  }
}


// ============ Theme Toggle Functions ============
let currentTheme = localStorage.getItem('theme') || 'dark';

function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  setTheme(savedTheme, false);
}

function toggleTheme() {
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
}

function setTheme(theme, showNotification = true) {
  currentTheme = theme;
  localStorage.setItem('theme', theme);
  
  // Update theme options in sidebar
  const darkOption = document.getElementById('darkThemeOption');
  const lightOption = document.getElementById('lightThemeOption');
  
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    if (darkOption) darkOption.classList.remove('active');
    if (lightOption) lightOption.classList.add('active');
  } else {
    document.documentElement.removeAttribute('data-theme');
    if (darkOption) darkOption.classList.add('active');
    if (lightOption) lightOption.classList.remove('active');
  }
  
  if (showNotification) {
    showToast(`${theme === 'light' ? 'Light' : 'Dark'} theme enabled`);
  }
}

// Initialize theme on page load
document.addEventListener('DOMContentLoaded', initTheme);


// ============ Gas Sensor Functions (CO & AQI) ============

// Update UI with gas sensor data
function updateGasSensorUI(data) {
  // Check if device is online (same logic as main updateUI)
  let deviceOnline = isConnected;
  if (lastDataReceivedTime) {
    const timeDiff = (Date.now() - lastDataReceivedTime) / 1000;
    deviceOnline = timeDiff < 30 && isConnected;
  } else if (data.lastSeen) {
    const lastSeenTime = new Date(data.lastSeen).getTime();
    const timeDiff = (Date.now() - lastSeenTime) / 1000;
    deviceOnline = timeDiff < 30 && isConnected;
  }
  if (!isConnected) {
    deviceOnline = false;
  }
  
  // CO Sensor
  const coVal = document.getElementById('coVal');
  const coStatus = document.getElementById('coStatus');
  const coGauge = document.getElementById('coGauge');
  const coCard = document.querySelector('.sensor-card.co-card');
  const coHealthIcon = document.getElementById('coHealthIcon');
  
  if (coVal) {
    if (!deviceOnline) {
      coVal.textContent = '--';
    } else if (data.sensorWarmup) {
      coVal.textContent = '--';
    } else {
      coVal.textContent = (data.coPpm || 0).toFixed(0);
    }
  }
  
  if (coStatus) {
    if (!deviceOnline) {
      coStatus.textContent = '--';
      coStatus.className = 'status-value';
    } else {
      const status = data.sensorWarmup ? 'warmup' : (data.coStatus || 'normal');
      coStatus.textContent = formatStatus(status);
      coStatus.className = 'status-value co-' + status.replace('_', '-');
    }
  }
  
  // Update CO gauge (max 500 PPM for display)
  if (coGauge) {
    if (!deviceOnline) {
      updateGauge('coGauge', 0, 500);
    } else if (!data.sensorWarmup) {
      updateGauge('coGauge', Math.min(data.coPpm || 0, 500), 500);
    }
  }
  
  // Update CO card status class
  if (coCard) {
    coCard.classList.remove('status-warning', 'status-danger', 'status-critical');
    if (deviceOnline && !data.sensorWarmup && data.coStatus) {
      if (data.coStatus === 'warning') coCard.classList.add('status-warning');
      else if (data.coStatus === 'danger') coCard.classList.add('status-danger');
      else if (data.coStatus === 'critical') coCard.classList.add('status-critical');
    }
  }
  
  // AQI Sensor
  const aqiVal = document.getElementById('aqiVal');
  const aqiStatus = document.getElementById('aqiStatus');
  const aqiGauge = document.getElementById('aqiGauge');
  const aqiCard = document.querySelector('.sensor-card.aqi-card');
  const aqiHealthIcon = document.getElementById('aqiHealthIcon');
  
  if (aqiVal) {
    if (!deviceOnline) {
      aqiVal.textContent = '--';
    } else if (data.sensorWarmup) {
      aqiVal.textContent = '--';
    } else {
      aqiVal.textContent = Math.round(data.aqi || 0);
    }
  }
  
  if (aqiStatus) {
    if (!deviceOnline) {
      aqiStatus.textContent = '--';
      aqiStatus.className = 'status-value';
    } else {
      const status = data.sensorWarmup ? 'warmup' : (data.aqiStatus || 'good');
      aqiStatus.textContent = formatStatus(status);
      aqiStatus.className = 'status-value aqi-' + status.replace('_', '-');
    }
  }
  
  // Update AQI gauge (max 500)
  if (aqiGauge) {
    if (!deviceOnline) {
      updateGauge('aqiGauge', 0, 500);
    } else if (!data.sensorWarmup) {
      updateGauge('aqiGauge', Math.min(data.aqi || 0, 500), 500);
    }
  }
  
  // Update AQI card status class
  if (aqiCard) {
    aqiCard.classList.remove('status-moderate', 'status-unhealthy-sensitive', 'status-unhealthy');
    if (!data.sensorWarmup && data.aqiStatus) {
      if (data.aqiStatus === 'moderate') aqiCard.classList.add('status-moderate');
      else if (data.aqiStatus === 'unhealthy_sensitive') aqiCard.classList.add('status-unhealthy-sensitive');
      else if (data.aqiStatus === 'unhealthy') aqiCard.classList.add('status-unhealthy');
    }
  }
  
  // Sensor health indicators
  if (coHealthIcon) {
    coHealthIcon.classList.toggle('hidden', data.sensorHealth !== 'warning');
  }
  if (aqiHealthIcon) {
    aqiHealthIcon.classList.toggle('hidden', data.sensorHealth !== 'warning');
  }
  
  // Warmup banner
  const warmupBanner = document.getElementById('warmupBanner');
  if (warmupBanner) {
    warmupBanner.classList.toggle('hidden', !data.sensorWarmup);
  }
  
  // Fire risk banner
  const fireRiskBanner = document.getElementById('fireRiskBanner');
  const fireRiskTriggers = document.getElementById('fireRiskTriggers');
  if (fireRiskBanner) {
    fireRiskBanner.classList.toggle('hidden', !data.fireRisk);
    if (data.fireRisk && fireRiskTriggers) {
      fireRiskTriggers.textContent = 'CO + Temperature + Gas sensors triggered';
    }
  }
}

// Format status text for display
function formatStatus(status) {
  const statusMap = {
    'normal': 'Normal',
    'warning': 'Warning',
    'danger': 'Danger',
    'critical': 'CRITICAL',
    'good': 'Good',
    'moderate': 'Moderate',
    'unhealthy_sensitive': 'Unhealthy (Sensitive)',
    'unhealthy': 'Unhealthy',
    'warmup': 'Warming Up...'
  };
  return statusMap[status] || status;
}

// Extend the existing updateUI function to include gas sensors
const originalUpdateUI = updateUI;
updateUI = function(data, isRealtimeUpdate = false) {
  originalUpdateUI(data, isRealtimeUpdate);
  updateGasSensorUI(data);
  
  // Only update alarm state if device is online
  // Device online status is determined in originalUpdateUI
  const isDeviceOnline = isConnected && hasReceivedRealtimeData;
  if (isDeviceOnline) {
    updateAlarmStateExtended(data);
  } else {
    // Clear alarm when offline
    const alarmCard = document.getElementById('alarmCard');
    const alarmIcon = document.getElementById('alarmIcon');
    const alarmText = document.getElementById('alarmText');
    const alarmSubtitle = document.getElementById('alarmSubtitle');
    
    if (alarmCard) alarmCard.classList.remove('alarm-active', 'fire-risk');
    if (alarmIcon) alarmIcon.className = 'fas fa-shield-check';
    if (alarmText) alarmText.textContent = 'System Offline';
    if (alarmSubtitle) alarmSubtitle.textContent = 'Device disconnected';
    stopAlarmSound();
  }
};

// Extended alarm state handling
function updateAlarmStateExtended(data) {
  const alarmCard = document.getElementById('alarmCard');
  const alarmIcon = document.getElementById('alarmIcon');
  const alarmText = document.getElementById('alarmText');
  const alarmSubtitle = document.getElementById('alarmSubtitle');
  
  // Fire risk takes highest priority
  if (data.fireRisk) {
    if (alarmCard) alarmCard.classList.add('alarm-active', 'fire-risk');
    if (alarmIcon) alarmIcon.className = 'fas fa-fire';
    if (alarmText) alarmText.textContent = 'FIRE RISK!';
    if (alarmSubtitle) alarmSubtitle.textContent = 'Multiple sensors triggered - evacuate if necessary!';
    playAlarmSound();
    return;
  }
  
  // CO critical/danger
  if (!data.sensorWarmup && (data.coStatus === 'critical' || data.coStatus === 'danger')) {
    if (alarmCard) alarmCard.classList.add('alarm-active');
    if (alarmIcon) alarmIcon.className = 'fas fa-skull-crossbones';
    if (alarmText) alarmText.textContent = data.coStatus === 'critical' ? 'CO CRITICAL!' : 'CO DANGER!';
    if (alarmSubtitle) {
      alarmSubtitle.textContent = data.coStatus === 'critical' 
        ? 'EVACUATE IMMEDIATELY! CO at ' + (data.coPpm || 0).toFixed(0) + ' PPM'
        : 'Ventilate area! CO at ' + (data.coPpm || 0).toFixed(0) + ' PPM';
    }
    playAlarmSound();
    return;
  }
  
  // Remove fire-risk class if not active
  if (alarmCard) alarmCard.classList.remove('fire-risk');
}

// CO Threshold Settings
async function saveCOThresholds() {
  if (!isAdmin()) {
    showToast('Admin access required', 'error');
    return;
  }
  
  const warning = parseInt(document.getElementById('coWarningSlider')?.value || 35);
  const danger = parseInt(document.getElementById('coDangerSlider')?.value || 100);
  const critical = parseInt(document.getElementById('coCriticalSlider')?.value || 400);
  
  try {
    const response = await fetch(`${CONFIG.API_URL}/api/device/${getDeviceId()}/co-thresholds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('householdToken'),
        'X-Admin-PIN': localStorage.getItem('adminPin')
      },
      body: JSON.stringify({ warning, danger, critical })
    });
    
    if (response.ok) {
      showToast('CO thresholds saved');
    } else {
      throw new Error('Failed to save');
    }
  } catch (error) {
    showToast('Error saving CO thresholds', 'error');
  }
}

// Reset all thresholds to factory defaults
async function resetThresholdsToDefault() {
  if (!isAdmin()) {
    showToast('Admin access required', 'error');
    return;
  }
  
  if (!confirm('Reset all sensor thresholds to factory defaults?\n\n• Gas: 40%\n• Smoke: 40%\n• Temperature: 60°C\n• CO: 35/100/400 PPM')) {
    return;
  }
  
  // Default values
  const defaults = {
    gas: 40,
    smoke: 40,
    temp: 60,
    coWarning: 35,
    coDanger: 100,
    coCritical: 400
  };
  
  try {
    // Update UI immediately
    const gasSlider = document.getElementById('thresholdSlider');
    const smokeSlider = document.getElementById('smokeThresholdSlider');
    const tempSlider = document.getElementById('tempThresholdSlider');
    const coWarningSlider = document.getElementById('coWarningSlider');
    const coDangerSlider = document.getElementById('coDangerSlider');
    const coCriticalSlider = document.getElementById('coCriticalSlider');
    
    if (gasSlider) {
      gasSlider.value = defaults.gas;
      updateThresholdBadge(gasSlider, document.getElementById('sliderValue'), 'gas');
    }
    if (smokeSlider) {
      smokeSlider.value = defaults.smoke;
      updateThresholdBadge(smokeSlider, document.getElementById('smokeSliderValue'), 'smoke');
    }
    if (tempSlider) {
      tempSlider.value = defaults.temp;
      updateThresholdBadge(tempSlider, document.getElementById('tempSliderValue'), 'temp');
    }
    if (coWarningSlider) {
      coWarningSlider.value = defaults.coWarning;
      updateCOSliderValue('coWarningSlider', 'coWarningVal');
    }
    if (coDangerSlider) {
      coDangerSlider.value = defaults.coDanger;
      updateCOSliderValue('coDangerSlider', 'coDangerVal');
    }
    if (coCriticalSlider) {
      coCriticalSlider.value = defaults.coCritical;
      updateCOSliderValue('coCriticalSlider', 'coCriticalVal');
    }
    
    // Save all thresholds to server
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + localStorage.getItem('householdToken'),
      'X-Admin-PIN': localStorage.getItem('adminPin')
    };
    
    // Save gas threshold
    await fetch(`${CONFIG.API_URL}/api/device/${getDeviceId()}/threshold`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ threshold: defaults.gas })
    });
    
    // Save smoke threshold
    await fetch(`${CONFIG.API_URL}/api/device/${getDeviceId()}/smoke-threshold`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ threshold: defaults.smoke })
    });
    
    // Save temp threshold
    await fetch(`${CONFIG.API_URL}/api/device/${getDeviceId()}/temp-threshold`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ threshold: defaults.temp })
    });
    
    // Save CO thresholds
    await fetch(`${CONFIG.API_URL}/api/device/${getDeviceId()}/co-thresholds`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        warning: defaults.coWarning, 
        danger: defaults.coDanger, 
        critical: defaults.coCritical 
      })
    });
    
    showToast('All thresholds reset to defaults', 'success');
  } catch (error) {
    console.error('Error resetting thresholds:', error);
    showToast('Error resetting thresholds', 'error');
  }
}

// Calibration
async function startCalibration() {
  if (!isAdmin()) {
    showToast('Admin access required', 'error');
    return;
  }
  
  if (!confirm('Start sensor calibration? Ensure sensors are in clean air.')) {
    return;
  }
  
  try {
    const response = await fetch(`${CONFIG.API_URL}/api/device/${getDeviceId()}/calibrate`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('householdToken'),
        'X-Admin-PIN': localStorage.getItem('adminPin')
      }
    });
    
    if (response.ok) {
      showToast('Calibration started - please wait...');
    } else {
      throw new Error('Failed to start calibration');
    }
  } catch (error) {
    showToast('Error starting calibration', 'error');
  }
}

// ============ WIFI CONFIGURATION WIZARD ============

let wifiWizardStep = 1;

function openWifiWizard() {
  if (!isAdmin()) {
    showToast('Admin access required', 'error');
    return;
  }
  
  const modal = document.getElementById('wifiWizardModal');
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    goToWifiStep(1);
  }
}

function closeWifiWizard() {
  const modal = document.getElementById('wifiWizardModal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
  wifiWizardStep = 1;
}

function goToWifiStep(step) {
  wifiWizardStep = step;
  
  // Hide all steps
  for (let i = 1; i <= 4; i++) {
    const stepEl = document.getElementById(`wifiWizardStep${i}`);
    const indicator = document.getElementById(`wifiStep${i}Indicator`);
    const line = document.getElementById(`wifiLine${i}`);
    
    if (stepEl) stepEl.classList.add('hidden');
    if (indicator) {
      indicator.classList.remove('active', 'completed');
      if (i < step) indicator.classList.add('completed');
      if (i === step) indicator.classList.add('active');
    }
    if (line && i < step) line.classList.add('active');
    if (line && i >= step) line.classList.remove('active');
  }
  
  // Show current step
  const currentStep = document.getElementById(`wifiWizardStep${step}`);
  if (currentStep) {
    currentStep.classList.remove('hidden');
  }
}

async function startWifiReset() {
  goToWifiStep(2);
  
  const progressBar = document.getElementById('wifiResetProgress');
  const statusText = document.getElementById('wifiResetStatus');
  
  // Animate progress
  let progress = 0;
  const progressInterval = setInterval(() => {
    progress += 2;
    if (progressBar) progressBar.style.width = Math.min(progress, 90) + '%';
  }, 50);
  
  try {
    if (statusText) statusText.textContent = 'Connecting to server...';
    await new Promise(r => setTimeout(r, 500));
    
    if (statusText) statusText.textContent = 'Sending reset command...';
    
    const deviceId = getDeviceId();
    console.log('[WiFi Reset] Sending to device:', deviceId);
    console.log('[WiFi Reset] URL:', `${CONFIG.API_URL}/api/device/${deviceId}/reset-wifi`);
    
    const response = await fetch(`${CONFIG.API_URL}/api/device/${deviceId}/reset-wifi`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('householdToken'),
        'X-Admin-PIN': localStorage.getItem('adminPin')
      }
    });
    
    clearInterval(progressInterval);
    
    const responseData = await response.json().catch(() => ({}));
    console.log('[WiFi Reset] Response:', response.status, responseData);
    
    if (response.ok) {
      if (progressBar) progressBar.style.width = '100%';
      if (statusText) statusText.textContent = 'Command sent successfully!';
      
      await new Promise(r => setTimeout(r, 800));
      goToWifiStep(3);
      showToast('WiFi reset command sent!', 'success');
    } else {
      console.error('[WiFi Reset] Error:', response.status, responseData);
      throw new Error(responseData.error || 'Failed to send reset command');
    }
  } catch (error) {
    console.error('[WiFi Reset] Exception:', error);
    clearInterval(progressInterval);
    if (progressBar) progressBar.style.width = '0%';
    if (statusText) statusText.textContent = 'Failed: ' + error.message;
    showToast('Error: ' + error.message, 'error');
    
    // Go back to step 1 after delay
    await new Promise(r => setTimeout(r, 2000));
    goToWifiStep(1);
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(`Copied: ${text}`, 'success');
    
    // Visual feedback on button
    event.target.closest('.btn-copy-small')?.classList.add('copied');
    setTimeout(() => {
      event.target.closest('.btn-copy-small')?.classList.remove('copied');
    }, 1500);
  }).catch(() => {
    showToast('Failed to copy', 'error');
  });
}

function toggleWifiTroubleshoot() {
  const content = document.getElementById('wifiTroubleshootContent');
  const toggle = document.querySelector('.wifi-troubleshoot-toggle');
  
  if (content && toggle) {
    content.classList.toggle('hidden');
    toggle.classList.toggle('active');
  }
}

// Reset device WiFi (legacy function - now uses wizard)
async function resetDeviceWifi() {
  openWifiWizard();
}

// Load gas history for charts
async function loadGasHistory(range = '24h') {
  try {
    const response = await fetch(`${CONFIG.API_URL}/api/device/${getDeviceId()}/gas-history?range=${range}`, {
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('householdToken')
      }
    });
    
    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (error) {
    console.error('Failed to load gas history:', error);
    return [];
  }
}

// ============ EMAIL ALERTS (Admin Only) ============

async function initEmailAlerts() {
  try {
    const settings = await api.getEmailAlerts();
    updateNotificationTabUI(settings);
  } catch (error) {
    console.error('Failed to load email alert settings:', error);
  }
}

// Update the Notifications tab UI
function updateNotificationTabUI(settings) {
  const emailToggle = document.getElementById('emailToggle');
  const emailStatus = document.getElementById('emailStatusText');
  const userEmail = document.getElementById('notifUserEmail');
  const userRole = document.getElementById('notifUserRole');
  
  // Only show email settings for admin
  if (settings.isAdmin) {
    if (emailToggle) {
      emailToggle.checked = settings.emailAlerts;
      emailToggle.disabled = false;
    }
    
    if (emailStatus) {
      if (settings.emailAlerts) {
        emailStatus.textContent = 'Enabled';
        emailStatus.classList.add('enabled');
      } else {
        emailStatus.textContent = 'Disabled';
        emailStatus.classList.remove('enabled');
      }
    }
    
    if (userEmail) {
      userEmail.textContent = settings.email || 'No email';
    }
    
    if (userRole) {
      userRole.textContent = 'Admin Account';
      userRole.style.color = 'var(--accent)';
    }
  }
}

async function toggleEmailAlert() {
  const emailToggle = document.getElementById('emailToggle');
  const emailStatus = document.getElementById('emailStatusText');
  
  const isEnabled = emailToggle ? emailToggle.checked : false;
  
  try {
    const result = await api.setEmailAlerts(isEnabled);
    
    if (emailStatus) {
      if (result.emailAlerts) {
        emailStatus.textContent = 'Enabled';
        emailStatus.classList.add('enabled');
        showToast('Email alerts enabled');
      } else {
        emailStatus.textContent = 'Disabled';
        emailStatus.classList.remove('enabled');
        showToast('Email alerts disabled');
      }
    }
  } catch (error) {
    if (emailToggle) emailToggle.checked = !isEnabled;
    showToast('Failed to update email settings', 'error');
  }
}

// Handle push notification toggle in new UI
async function handlePushToggle() {
  const pushToggle = document.getElementById('pushToggle');
  const pushStatus = document.getElementById('pushStatusText');
  
  if (pushToggle.checked) {
    await subscribeToPush();
  } else {
    await unsubscribeFromPush();
  }
  
  // Update status text
  updatePushToggleUI();
}

// Update push toggle UI based on subscription state
function updatePushToggleUI() {
  const pushToggle = document.getElementById('pushToggle');
  const pushStatus = document.getElementById('pushStatusText');
  
  if (pushToggle && pushSubscription) {
    pushToggle.checked = true;
    if (pushStatus) {
      pushStatus.textContent = 'Enabled';
      pushStatus.classList.add('enabled');
    }
  } else if (pushToggle) {
    pushToggle.checked = false;
    if (pushStatus) {
      pushStatus.textContent = 'Disabled';
      pushStatus.classList.remove('enabled');
    }
  }
}


// ============ HOUSEHOLD MEMBERS MANAGEMENT ============
let membersTabVerified = false;
let accessCodeVisible = false;
let selectionMode = false;
let selectedMembers = new Set();

// Handle Members tab click - require PIN verification
function setupMembersTab() {
  const membersTab = document.querySelector('[data-tab="members"]');
  if (membersTab) {
    membersTab.addEventListener('click', (e) => {
      // Reset verification when tab is clicked
      if (!membersTabVerified) {
        showMembersPinScreen();
      }
    });
  }
}

function showMembersPinScreen() {
  const pinScreen = document.getElementById('membersPinScreen');
  const content = document.getElementById('membersContent');
  const pinInput = document.getElementById('membersPinInput');
  const pinError = document.getElementById('membersPinError');
  
  if (pinScreen) pinScreen.classList.remove('hidden');
  if (content) content.classList.add('hidden');
  if (pinInput) {
    pinInput.value = '';
    pinInput.focus();
  }
  if (pinError) pinError.textContent = '';
}

async function verifyMembersPin() {
  const pinInput = document.getElementById('membersPinInput');
  const pinError = document.getElementById('membersPinError');
  const pin = pinInput?.value || '';
  
  if (!pin || pin.length < 4) {
    if (pinError) pinError.textContent = 'Please enter your PIN';
    return;
  }
  
  try {
    // Verify PIN with server
    const result = await api.verifyAdminPin(pin);
    
    if (result.success) {
      membersTabVerified = true;
      showMembersContent();
      loadMembersFullList();
      loadHouseholdInfoForMembers();
    } else {
      if (pinError) pinError.textContent = 'Invalid PIN';
      if (pinInput) pinInput.value = '';
    }
  } catch (error) {
    if (pinError) pinError.textContent = error.message || 'Verification failed';
    if (pinInput) pinInput.value = '';
  }
}

function showMembersContent() {
  const pinScreen = document.getElementById('membersPinScreen');
  const content = document.getElementById('membersContent');
  
  if (pinScreen) pinScreen.classList.add('hidden');
  if (content) content.classList.remove('hidden');
}

async function loadHouseholdInfoForMembers() {
  try {
    const info = await api.getHouseholdCredentials();
    
    const householdIdEl = document.getElementById('membersHouseholdId');
    const accessCodeEl = document.getElementById('membersAccessCode');
    
    if (householdIdEl) householdIdEl.textContent = info.householdId || '--';
    if (accessCodeEl) {
      accessCodeEl.dataset.code = info.accessCode || '------';
      accessCodeEl.textContent = accessCodeVisible ? info.accessCode : '******';
    }
  } catch (error) {
    console.error('Failed to load household info:', error);
  }
}

function toggleAccessCode() {
  const accessCodeEl = document.getElementById('membersAccessCode');
  const btn = document.querySelector('.btn-show-code i');
  
  accessCodeVisible = !accessCodeVisible;
  
  if (accessCodeEl) {
    accessCodeEl.textContent = accessCodeVisible ? accessCodeEl.dataset.code : '******';
  }
  if (btn) {
    btn.className = accessCodeVisible ? 'fas fa-eye-slash' : 'fas fa-eye';
  }
}

function toggleSelectionMode() {
  selectionMode = !selectionMode;
  selectedMembers.clear();
  
  const toolbar = document.getElementById('membersToolbar');
  const membersList = document.getElementById('membersListFull');
  const selectAllCheckbox = document.getElementById('selectAllMembers');
  
  if (toolbar) toolbar.classList.toggle('hidden', !selectionMode);
  if (membersList) membersList.classList.toggle('selection-mode', selectionMode);
  if (selectAllCheckbox) selectAllCheckbox.checked = false;
  
  updateSelectedCount();
  loadMembersFullList();
}

function toggleSelectAll() {
  const selectAllCheckbox = document.getElementById('selectAllMembers');
  const checkboxes = document.querySelectorAll('.member-checkbox');
  
  checkboxes.forEach(cb => {
    cb.checked = selectAllCheckbox.checked;
    const memberId = cb.dataset.memberId;
    if (selectAllCheckbox.checked) {
      selectedMembers.add(memberId);
    } else {
      selectedMembers.delete(memberId);
    }
    
    // Update visual state
    const memberItem = cb.closest('.member-item');
    if (memberItem) {
      memberItem.classList.toggle('selected', selectAllCheckbox.checked);
    }
  });
  
  updateSelectedCount();
}

function toggleMemberSelection(memberId, checkbox) {
  if (checkbox.checked) {
    selectedMembers.add(memberId);
  } else {
    selectedMembers.delete(memberId);
  }
  
  // Update visual state
  const memberItem = checkbox.closest('.member-item');
  if (memberItem) {
    memberItem.classList.toggle('selected', checkbox.checked);
  }
  
  // Update select all checkbox
  const allCheckboxes = document.querySelectorAll('.member-checkbox');
  const selectAllCheckbox = document.getElementById('selectAllMembers');
  if (selectAllCheckbox) {
    selectAllCheckbox.checked = selectedMembers.size === allCheckboxes.length && allCheckboxes.length > 0;
  }
  
  updateSelectedCount();
}

function updateSelectedCount() {
  const countEl = document.getElementById('selectedCount');
  if (countEl) {
    countEl.textContent = `${selectedMembers.size} selected`;
  }
}

async function loadMembersFullList() {
  const membersList = document.getElementById('membersListFull');
  const totalCount = document.getElementById('membersTotalCount');
  
  if (!membersList) return;
  
  membersList.innerHTML = '<div class="loading-members"><i class="fas fa-spinner fa-spin"></i> Loading members...</div>';
  
  try {
    const data = await api.getHouseholdMembers();
    
    if (totalCount) totalCount.textContent = (data.members?.length || 0) + 1; // +1 for admin
    
    let html = '';
    
    // Show admin first (not selectable)
    if (data.admin) {
      const adminInitial = data.admin.email.charAt(0).toUpperCase();
      const adminDate = data.admin.createdAt ? new Date(data.admin.createdAt).toLocaleDateString() : 'Unknown';
      html += `
        <div class="member-item admin-member">
          <div class="member-info">
            <div class="member-avatar" style="background: linear-gradient(135deg, #ff5722, #ff9800);">${adminInitial}</div>
            <div class="member-details">
              <span class="member-name">${data.admin.email.split('@')[0]}</span>
              <span class="member-meta"><i class="fas fa-envelope"></i> ${data.admin.email}</span>
              <span class="member-meta"><i class="fas fa-calendar"></i> Created ${adminDate}</span>
            </div>
          </div>
          <span class="member-badge admin"><i class="fas fa-crown"></i> Admin</span>
        </div>
      `;
    }
    
    // Show members
    if (data.members && data.members.length > 0) {
      data.members.forEach(member => {
        const initial = member.name.charAt(0).toUpperCase();
        const addedDate = member.addedAt ? new Date(member.addedAt).toLocaleDateString() : 'Unknown';
        const isSelected = selectedMembers.has(member.id);
        
        html += `
          <div class="member-item ${selectionMode ? 'selectable' : ''} ${isSelected ? 'selected' : ''}" data-member-id="${member.id}">
            ${selectionMode ? `
              <input type="checkbox" class="member-checkbox" data-member-id="${member.id}" 
                ${isSelected ? 'checked' : ''} 
                onchange="toggleMemberSelection('${member.id}', this)">
            ` : ''}
            <div class="member-info" ${selectionMode ? `onclick="document.querySelector('.member-checkbox[data-member-id=\\'${member.id}\\']').click()"` : ''}>
              <div class="member-avatar">${initial}</div>
              <div class="member-details">
                <span class="member-name">${member.name}</span>
                <span class="member-meta"><i class="fas fa-calendar"></i> Joined ${addedDate}</span>
              </div>
            </div>
            ${!selectionMode ? `
              <div class="member-actions">
                <span class="member-badge member">Member</span>
                <button class="btn-remove-member" onclick="removeMember('${member.id}', '${member.name}')" title="Remove member">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            ` : ''}
          </div>
        `;
      });
    } else {
      html += '<div class="no-members"><i class="fas fa-user-plus"></i> No household members yet. Share your access code to invite members.</div>';
    }
    
    membersList.innerHTML = html;
    if (selectionMode) membersList.classList.add('selection-mode');
  } catch (error) {
    console.error('Failed to load members:', error);
    membersList.innerHTML = '<div class="no-members"><i class="fas fa-exclamation-circle"></i> Failed to load members</div>';
  }
}

async function deleteSelectedMembers() {
  if (selectedMembers.size === 0) {
    showToast('No members selected', 'error');
    return;
  }
  
  if (!confirm(`Delete ${selectedMembers.size} selected member(s)?\n\nThey will need to re-enter their names to access again.`)) {
    return;
  }
  
  try {
    const memberIds = Array.from(selectedMembers);
    await api.removeMultipleMembers(memberIds);
    
    showToast(`Removed ${selectedMembers.size} member(s)`);
    selectedMembers.clear();
    updateSelectedCount();
    loadMembersFullList();
    
    // Update select all checkbox
    const selectAllCheckbox = document.getElementById('selectAllMembers');
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
  } catch (error) {
    showToast('Failed to remove members', 'error');
  }
}

async function removeMember(memberId, memberName) {
  if (!confirm(`Remove "${memberName}" from this household?\n\nThey will need to re-enter their name to access again.`)) {
    return;
  }
  
  try {
    await api.removeMember(memberId);
    showToast(`Removed ${memberName}`);
    loadMembersFullList();
  } catch (error) {
    showToast('Failed to remove member', 'error');
  }
}

async function clearAllMembers() {
  if (!confirm('Remove ALL household members?\n\nThis will log out everyone except the admin. They will need to re-enter their names to access again.')) {
    return;
  }
  
  try {
    await api.clearAllMembers();
    showToast('All members removed');
    selectedMembers.clear();
    updateSelectedCount();
    loadMembersFullList();
  } catch (error) {
    showToast('Failed to clear members', 'error');
  }
}

async function changeAccessCode() {
  const input = document.getElementById('newAccessCodeInput');
  const newCode = input?.value || '';
  
  if (!/^\d{6}$/.test(newCode)) {
    showToast('Access code must be 6 digits', 'error');
    return;
  }
  
  if (!confirm('Change access code?\n\nThis will log out all current household members.')) {
    return;
  }
  
  try {
    await api.changeAccessCode(newCode);
    showToast('Access code updated');
    if (input) input.value = '';
    loadHouseholdInfoForMembers();
  } catch (error) {
    showToast('Failed to change access code', 'error');
  }
}

// Initialize members tab on page load
document.addEventListener('DOMContentLoaded', () => {
  setupMembersTab();
});

// ============ SENSOR STATISTICS DISPLAY ============

// Toggle statistics panel visibility
function toggleStatsPanel() {
  const panel = document.getElementById('sessionStatsPanel');
  const btn = document.getElementById('statsToggleBtn');
  const arrow = document.getElementById('statsToggleArrow');
  
  if (panel && btn) {
    const isVisible = panel.classList.toggle('visible');
    btn.classList.toggle('active', isVisible);
    
    // Rotate arrow
    if (arrow) {
      arrow.style.transform = isVisible ? 'rotate(180deg)' : 'rotate(0deg)';
    }
    
    // Load today's stats when panel opens
    if (isVisible) {
      switchStatsPeriod('today');
    }
    
    // Save preference
    localStorage.setItem('statsExpanded', isVisible);
  }
}

// Load stats panel state from localStorage
function loadStatsPanelState() {
  const expanded = localStorage.getItem('statsExpanded') === 'true';
  const panel = document.getElementById('sessionStatsPanel');
  const btn = document.getElementById('statsToggleBtn');
  const arrow = document.getElementById('statsToggleArrow');
  
  if (expanded && panel && btn) {
    panel.classList.add('visible');
    btn.classList.add('active');
    if (arrow) arrow.style.transform = 'rotate(180deg)';
    // Load today's stats
    switchStatsPeriod('today');
  }
}

// Initialize stats panel state on load
document.addEventListener('DOMContentLoaded', loadStatsPanelState);


// ============ CALIBRATION WIZARD ============
let calibrationWizardStep = 1;
let calibrationCheckInterval = null;
let wizardDataInterval = null;

function openCalibrationWizard() {
  if (!isAdmin()) {
    showToast('Admin access required', 'error');
    return;
  }
  
  const modal = document.getElementById('calibrationModal');
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    resetCalibrationWizard();
    goToWizardStep(1);
  }
}

function closeCalibrationWizard() {
  const modal = document.getElementById('calibrationModal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
  
  // Clear intervals
  if (calibrationCheckInterval) {
    clearInterval(calibrationCheckInterval);
    calibrationCheckInterval = null;
  }
  if (wizardDataInterval) {
    clearInterval(wizardDataInterval);
    wizardDataInterval = null;
  }
}

function resetCalibrationWizard() {
  calibrationWizardStep = 1;
  
  // Reset checkboxes
  for (let i = 1; i <= 4; i++) {
    const check = document.getElementById(`check${i}`);
    if (check) check.checked = false;
  }
  
  // Reset button states
  const step1Btn = document.getElementById('step1NextBtn');
  const step2Btn = document.getElementById('step2NextBtn');
  if (step1Btn) step1Btn.disabled = true;
  if (step2Btn) step2Btn.disabled = true;
  
  // Reset progress
  const progressFill = document.getElementById('calibrationProgressFill');
  const progressText = document.getElementById('calibrationProgressText');
  if (progressFill) progressFill.style.width = '0%';
  if (progressText) progressText.textContent = '0%';
}

function goToWizardStep(step) {
  calibrationWizardStep = step;
  
  // Hide all steps
  for (let i = 1; i <= 4; i++) {
    const stepContent = document.getElementById(`wizardStep${i}`);
    const stepIndicator = document.querySelector(`.wizard-step[data-step="${i}"]`);
    
    if (stepContent) stepContent.classList.add('hidden');
    if (stepIndicator) {
      stepIndicator.classList.remove('active', 'completed');
      if (i < step) stepIndicator.classList.add('completed');
      if (i === step) stepIndicator.classList.add('active');
    }
  }
  
  // Show current step
  const currentStep = document.getElementById(`wizardStep${step}`);
  if (currentStep) currentStep.classList.remove('hidden');
  
  // Step-specific actions
  if (step === 2) {
    startWarmupCheck();
  } else if (step === 3) {
    startCalibrationProcess();
  }
}

function updateWizardChecklist() {
  const allChecked = 
    document.getElementById('check1')?.checked &&
    document.getElementById('check2')?.checked &&
    document.getElementById('check3')?.checked &&
    document.getElementById('check4')?.checked;
  
  const nextBtn = document.getElementById('step1NextBtn');
  if (nextBtn) nextBtn.disabled = !allChecked;
}

function startWarmupCheck() {
  // Start updating sensor readings
  updateWizardSensorData();
  wizardDataInterval = setInterval(updateWizardSensorData, 2000);
  
  // Check warmup status after a short delay
  setTimeout(checkSensorWarmup, 1500);
}

function updateWizardSensorData() {
  // Get current sensor data from the main UI
  const coRaw = document.getElementById('coVal')?.textContent || '--';
  const aqiRaw = document.getElementById('aqiVal')?.textContent || '--';
  const smokeRaw = document.getElementById('smokeVal')?.textContent || '--';
  const temp = document.getElementById('tempVal')?.textContent || '--';
  
  // Update wizard display
  const wizardCoRaw = document.getElementById('wizardCoRaw');
  const wizardAqiRaw = document.getElementById('wizardAqiRaw');
  const wizardSmokeRaw = document.getElementById('wizardSmokeRaw');
  const wizardTemp = document.getElementById('wizardTemp');
  
  if (wizardCoRaw) wizardCoRaw.textContent = coRaw;
  if (wizardAqiRaw) wizardAqiRaw.textContent = aqiRaw;
  if (wizardSmokeRaw) wizardSmokeRaw.textContent = smokeRaw;
  if (wizardTemp) wizardTemp.textContent = temp + '°C';
}

function checkSensorWarmup() {
  // Check if device is online
  const deviceStatus = document.getElementById('deviceStatus')?.textContent;
  const isOnline = deviceStatus === 'Online';
  
  // Update CO sensor status
  const coStatus = document.getElementById('coWarmupStatus');
  const coIndicator = document.getElementById('coWarmupIndicator');
  if (coStatus && coIndicator) {
    if (isOnline) {
      coStatus.textContent = 'Ready';
      coStatus.classList.add('ready');
      coIndicator.innerHTML = '<i class="fas fa-check-circle"></i>';
      coIndicator.classList.add('ready');
    } else {
      coStatus.textContent = 'Device offline';
      coStatus.classList.add('warning');
      coIndicator.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
      coIndicator.classList.add('warning');
    }
  }
  
  // Update AQI sensor status
  const aqiStatus = document.getElementById('aqiWarmupStatus');
  const aqiIndicator = document.getElementById('aqiWarmupIndicator');
  if (aqiStatus && aqiIndicator) {
    if (isOnline) {
      aqiStatus.textContent = 'Ready';
      aqiStatus.classList.add('ready');
      aqiIndicator.innerHTML = '<i class="fas fa-check-circle"></i>';
      aqiIndicator.classList.add('ready');
    } else {
      aqiStatus.textContent = 'Device offline';
      aqiStatus.classList.add('warning');
      aqiIndicator.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
      aqiIndicator.classList.add('warning');
    }
  }
  
  // Update Smoke sensor status
  const smokeStatus = document.getElementById('smokeWarmupStatus');
  const smokeIndicator = document.getElementById('smokeWarmupIndicator');
  if (smokeStatus && smokeIndicator) {
    if (isOnline) {
      smokeStatus.textContent = 'Ready';
      smokeStatus.classList.add('ready');
      smokeIndicator.innerHTML = '<i class="fas fa-check-circle"></i>';
      smokeIndicator.classList.add('ready');
    } else {
      smokeStatus.textContent = 'Device offline';
      smokeStatus.classList.add('warning');
      smokeIndicator.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
      smokeIndicator.classList.add('warning');
    }
  }
  
  // Enable next button if device is online
  const step2Btn = document.getElementById('step2NextBtn');
  if (step2Btn) step2Btn.disabled = !isOnline;
}

async function startCalibrationProcess() {
  // Clear data interval
  if (wizardDataInterval) {
    clearInterval(wizardDataInterval);
    wizardDataInterval = null;
  }
  
  const progressFill = document.getElementById('calibrationProgressFill');
  const progressText = document.getElementById('calibrationProgressText');
  const statusBox = document.getElementById('calibrationStatusBox');
  
  // Update status messages
  const statusMessages = [
    { progress: 10, message: 'Sending calibration command to device...' },
    { progress: 25, message: 'Sampling clean air readings...' },
    { progress: 50, message: 'Calculating baseline resistance (Ro)...' },
    { progress: 75, message: 'Storing calibration values...' },
    { progress: 90, message: 'Verifying calibration...' },
    { progress: 100, message: 'Calibration complete!' }
  ];
  
  let currentStatus = 0;
  
  // Send calibration command to ESP32
  try {
    const response = await fetch(`${CONFIG.API_URL}/api/device/${getDeviceId()}/calibrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('householdToken')}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to send calibration command');
    }
    
    // Animate progress
    const animateProgress = () => {
      if (currentStatus < statusMessages.length) {
        const status = statusMessages[currentStatus];
        
        if (progressFill) progressFill.style.width = status.progress + '%';
        if (progressText) progressText.textContent = status.progress + '%';
        if (statusBox) {
          statusBox.innerHTML = `
            <div class="calib-status-item">
              <i class="fas ${status.progress < 100 ? 'fa-circle-notch fa-spin' : 'fa-check-circle'}"></i>
              <span>${status.message}</span>
            </div>
          `;
        }
        
        currentStatus++;
        
        if (currentStatus < statusMessages.length) {
          setTimeout(animateProgress, 1500);
        } else {
          // Calibration complete - wait a bit then show results
          setTimeout(() => {
            fetchCalibrationResults();
          }, 1000);
        }
      }
    };
    
    animateProgress();
    
  } catch (error) {
    console.error('Calibration error:', error);
    if (statusBox) {
      statusBox.innerHTML = `
        <div class="calib-status-item" style="color: var(--danger);">
          <i class="fas fa-exclamation-circle"></i>
          <span>Calibration failed: ${error.message}</span>
        </div>
      `;
    }
    showToast('Calibration failed', 'error');
  }
}

async function fetchCalibrationResults() {
  try {
    const response = await fetch(`${CONFIG.API_URL}/api/device/${getDeviceId()}/calibration-status`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('householdToken')}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      
      // Update results display
      const newCoRo = document.getElementById('newCoRo');
      const newAqiRo = document.getElementById('newAqiRo');
      const calibrationTime = document.getElementById('calibrationTime');
      
      if (newCoRo) newCoRo.textContent = (data.coRo || 10000).toLocaleString() + ' Ω';
      if (newAqiRo) newAqiRo.textContent = (data.aqiRo || 10000).toLocaleString() + ' Ω';
      if (calibrationTime) {
        calibrationTime.textContent = data.lastCalibration 
          ? new Date(data.lastCalibration).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })
          : 'Just now';
      }
      
      // Update main display
      const lastCalibEl = document.getElementById('lastCalibration');
      const coRoEl = document.getElementById('coRoValue');
      const aqiRoEl = document.getElementById('aqiRoValue');
      
      if (lastCalibEl) lastCalibEl.textContent = calibrationTime?.textContent || 'Just now';
      if (coRoEl) coRoEl.textContent = (data.coRo || 10000).toLocaleString() + ' Ω';
      if (aqiRoEl) aqiRoEl.textContent = (data.aqiRo || 10000).toLocaleString() + ' Ω';
    }
    
    // Go to completion step
    goToWizardStep(4);
    showToast('Calibration completed successfully!', 'success');
    
  } catch (error) {
    console.error('Failed to fetch calibration results:', error);
    goToWizardStep(4);
  }
}

// Load calibration status on page load
async function loadCalibrationStatus() {
  try {
    const response = await fetch(`${CONFIG.API_URL}/api/device/${getDeviceId()}/calibration-status`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('householdToken')}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      
      const lastCalibEl = document.getElementById('lastCalibration');
      const coRoEl = document.getElementById('coRoValue');
      const aqiRoEl = document.getElementById('aqiRoValue');
      
      if (lastCalibEl) {
        lastCalibEl.textContent = data.lastCalibration 
          ? new Date(data.lastCalibration).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })
          : 'Never';
      }
      if (coRoEl) coRoEl.textContent = (data.coRo || 10000).toLocaleString() + ' Ω';
      if (aqiRoEl) aqiRoEl.textContent = (data.aqiRo || 10000).toLocaleString() + ' Ω';
    }
  } catch (error) {
    console.error('Failed to load calibration status:', error);
  }
}


// ============ HISTORICAL STATISTICS ============
let currentStatsPeriod = 'today';

async function switchStatsPeriod(period) {
  currentStatsPeriod = period;
  
  // Update tab UI
  document.querySelectorAll('.stats-period-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.period === period);
  });
  
  // Show loading state
  showStatsLoading();
  
  // Fetch historical data
  await loadHistoricalStats(period);
}

function showStatsLoading() {
  const periodLabel = document.getElementById('periodLabel');
  if (periodLabel) periodLabel.textContent = 'Loading...';
  
  // Reset all values to loading state
  ['temp', 'hum', 'gas', 'co', 'aqi', 'smoke'].forEach(prefix => {
    const minEl = document.getElementById(`${prefix}Min`);
    const maxEl = document.getElementById(`${prefix}Max`);
    const avgEl = document.getElementById(`${prefix}Avg`);
    if (minEl) minEl.textContent = '...';
    if (maxEl) maxEl.textContent = '...';
    if (avgEl) avgEl.textContent = '...';
  });
}

async function loadHistoricalStats(period) {
  try {
    const response = await fetch(`${CONFIG.API_URL}/api/device/${getDeviceId()}/stats/${period}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('householdToken')}`
      }
    });
    
    if (!response.ok) throw new Error('Failed to load stats');
    
    const data = await response.json();
    renderHistoricalStats(data, period);
    
  } catch (error) {
    console.error('Failed to load historical stats:', error);
    showStatsError();
  }
}

function renderHistoricalStats(data, period) {
  const periodLabel = document.getElementById('periodLabel');
  const periodRange = document.getElementById('periodRange');
  
  // Update period label
  const periodLabels = {
    today: 'Today',
    week: 'Last 7 Days',
    month: 'Last 30 Days'
  };
  if (periodLabel) periodLabel.textContent = periodLabels[period] || period;
  
  // Update date range
  if (periodRange && data.firstReading && data.lastReading) {
    const first = new Date(data.firstReading);
    const last = new Date(data.lastReading);
    const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    periodRange.textContent = `${first.toLocaleDateString('en-PH', options)} - ${last.toLocaleDateString('en-PH', options)}`;
  } else if (periodRange) {
    periodRange.textContent = 'No data';
  }
  
  // Check if we have data
  if (data.totalReadings === 0) {
    showStatsNoData();
    return;
  }
  
  const stats = data.stats;
  
  // Temperature
  updateHistoricalStatDisplay('temp', stats.temperature, 80, 1);
  
  // Humidity
  updateHistoricalStatDisplay('hum', stats.humidity, 100, 1);
  
  // Gas
  updateHistoricalStatDisplay('gas', stats.gas, 100, 1);
  
  // CO
  updateHistoricalStatDisplay('co', stats.co, 500, 0);
  
  // AQI
  updateHistoricalStatDisplay('aqi', stats.aqi, 500, 0);
  
  // Smoke (use gas data if smoke not available)
  updateHistoricalStatDisplay('smoke', stats.gas, 100, 1);
  
  // Update footer counts
  const totalReadingsEl = document.getElementById('totalReadings');
  const warningCountEl = document.getElementById('statsWarningCount');
  const dangerCountEl = document.getElementById('statsDangerCount');
  const warningContainer = document.getElementById('warningCountContainer');
  const dangerContainer = document.getElementById('dangerCountContainer');
  
  if (totalReadingsEl) totalReadingsEl.textContent = data.totalReadings.toLocaleString();
  
  if (warningCountEl && warningContainer) {
    warningCountEl.textContent = data.warningCount || 0;
    warningContainer.classList.toggle('hidden', !data.warningCount);
  }
  
  if (dangerCountEl && dangerContainer) {
    dangerCountEl.textContent = data.dangerCount || 0;
    dangerContainer.classList.toggle('hidden', !data.dangerCount);
  }
}

function updateHistoricalStatDisplay(prefix, stats, maxScale, decimals) {
  if (!stats) return;
  
  const minEl = document.getElementById(`${prefix}Min`);
  const maxEl = document.getElementById(`${prefix}Max`);
  const avgEl = document.getElementById(`${prefix}Avg`);
  const barEl = document.getElementById(`${prefix}StatBar`);
  const minMarker = document.getElementById(`${prefix}MinMarker`);
  const maxMarker = document.getElementById(`${prefix}MaxMarker`);
  
  const hasData = stats.min !== null && stats.max !== null;
  
  if (minEl) minEl.textContent = hasData ? stats.min.toFixed(decimals) : '--';
  if (maxEl) maxEl.textContent = hasData ? stats.max.toFixed(decimals) : '--';
  if (avgEl) avgEl.textContent = hasData && stats.avg !== null ? stats.avg.toFixed(decimals) : '--';
  
  if (hasData) {
    // Update bar fill (average position)
    if (barEl && stats.avg !== null) {
      const avgPercent = Math.min((stats.avg / maxScale) * 100, 100);
      barEl.style.width = avgPercent + '%';
    }
    
    // Update markers
    if (minMarker) {
      const minPercent = Math.min((stats.min / maxScale) * 100, 100);
      minMarker.style.left = minPercent + '%';
    }
    
    if (maxMarker) {
      const maxPercent = Math.min((stats.max / maxScale) * 100, 100);
      maxMarker.style.left = maxPercent + '%';
    }
  } else {
    if (barEl) barEl.style.width = '0%';
    if (minMarker) minMarker.style.left = '0%';
    if (maxMarker) maxMarker.style.left = '0%';
  }
}

function showStatsNoData() {
  const periodLabel = document.getElementById('periodLabel');
  const periodRange = document.getElementById('periodRange');
  
  if (periodRange) periodRange.textContent = 'No data available for this period';
  
  // Reset all values
  ['temp', 'hum', 'gas', 'co', 'aqi', 'smoke'].forEach(prefix => {
    const minEl = document.getElementById(`${prefix}Min`);
    const maxEl = document.getElementById(`${prefix}Max`);
    const avgEl = document.getElementById(`${prefix}Avg`);
    const barEl = document.getElementById(`${prefix}StatBar`);
    
    if (minEl) minEl.textContent = '--';
    if (maxEl) maxEl.textContent = '--';
    if (avgEl) avgEl.textContent = '--';
    if (barEl) barEl.style.width = '0%';
  });
  
  const totalReadingsEl = document.getElementById('totalReadings');
  if (totalReadingsEl) totalReadingsEl.textContent = '0';
}

function showStatsError() {
  const periodRange = document.getElementById('periodRange');
  if (periodRange) periodRange.textContent = 'Failed to load data';
  showStatsNoData();
}
