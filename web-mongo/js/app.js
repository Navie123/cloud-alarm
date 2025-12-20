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
});

// Called after successful household access
function initializeApp() {
  loadAlarmSoundSetting();
  loadMemberPreferences();
  initPushNotifications();
  connectWebSocket();
  loadInitialData();
  loadHistory();
  startHistoryAutoRefresh();
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
        updateUI(message.data);
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
    setConnected(false);
    
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
  } catch (error) {
    console.error('Failed to load initial data:', error);
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
    greeting = `Good Night${userName}!`;
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
function updateUI(data) {
  if (!data) return;
  
  // Gas gauge update
  const gasPercent = Math.min(data.gas || 0, 100);
  const gasVal = document.getElementById('gasVal');
  if (gasVal) gasVal.textContent = gasPercent.toFixed(1);
  updateGauge('gasGauge', gasPercent, 100);
  
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
  
  // Thresholds
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
  
  sirenEnabled = data.sirenEnabled !== false;
  updateSirenUI();
  
  updateAlarmState(data.alarm, data.tempWarning);
  
  // Device info
  const deviceId = document.getElementById('deviceId');
  if (deviceId) deviceId.textContent = CONFIG.DEVICE_ID;
  
  const lastUpdate = document.getElementById('lastUpdate');
  if (lastUpdate) lastUpdate.textContent = data.timestamp || '--';
  
  const lastSeen = document.getElementById('lastSeen');
  if (lastSeen) lastSeen.textContent = data.timestamp ? 'Just now' : '--';
  
  const connectionStatus = document.getElementById('connectionStatus');
  if (connectionStatus) connectionStatus.textContent = 'Connected';
  
  const deviceStatus = document.getElementById('deviceStatus');
  if (deviceStatus) {
    deviceStatus.textContent = 'Online';
    deviceStatus.classList.add('online');
  }
  
  updateSidebarInfo(data);
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
    }
  }
}

function updateSirenUI() {
  elements.sirenIcon.className = sirenEnabled ? 'fas fa-bell' : 'fas fa-bell-slash';
  elements.sirenText.textContent = sirenEnabled ? 'Siren On' : 'Siren Off';
  
  const sideIcon = document.getElementById('sirenIconSide');
  const sideText = document.getElementById('sirenTextSide');
  if (sideIcon) sideIcon.className = sirenEnabled ? 'fas fa-bell' : 'fas fa-bell-slash';
  if (sideText) sideText.textContent = sirenEnabled ? 'Siren On' : 'Siren Off';
  
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

async function silenceAlarm() {
  if (!isAdmin()) {
    showToast('Admin access required', 'error');
    return;
  }
  stopAlarmSound();
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


// ============ Gas Sensor Functions (CO & AQI) ============

// Update UI with gas sensor data
function updateGasSensorUI(data) {
  // CO Sensor
  const coVal = document.getElementById('coVal');
  const coStatus = document.getElementById('coStatus');
  const coGauge = document.getElementById('coGauge');
  const coCard = document.querySelector('.sensor-card.co-card');
  const coHealthIcon = document.getElementById('coHealthIcon');
  
  if (coVal) {
    if (data.sensorWarmup) {
      coVal.textContent = '--';
    } else {
      coVal.textContent = (data.coPpm || 0).toFixed(0);
    }
  }
  
  if (coStatus) {
    const status = data.sensorWarmup ? 'warmup' : (data.coStatus || 'normal');
    coStatus.textContent = formatStatus(status);
    coStatus.className = 'status-value co-' + status.replace('_', '-');
  }
  
  // Update CO gauge (max 500 PPM for display)
  if (coGauge && !data.sensorWarmup) {
    updateGauge('coGauge', Math.min(data.coPpm || 0, 500), 500);
  }
  
  // Update CO card status class
  if (coCard) {
    coCard.classList.remove('status-warning', 'status-danger', 'status-critical');
    if (!data.sensorWarmup && data.coStatus) {
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
    if (data.sensorWarmup) {
      aqiVal.textContent = '--';
    } else {
      aqiVal.textContent = Math.round(data.aqi || 0);
    }
  }
  
  if (aqiStatus) {
    const status = data.sensorWarmup ? 'warmup' : (data.aqiStatus || 'good');
    aqiStatus.textContent = formatStatus(status);
    aqiStatus.className = 'status-value aqi-' + status.replace('_', '-');
  }
  
  // Update AQI gauge (max 500)
  if (aqiGauge && !data.sensorWarmup) {
    updateGauge('aqiGauge', Math.min(data.aqi || 0, 500), 500);
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
updateUI = function(data) {
  originalUpdateUI(data);
  updateGasSensorUI(data);
  
  // Update alarm state to include CO and fire risk
  updateAlarmStateExtended(data);
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
