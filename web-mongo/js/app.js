// Cloud Fire Alarm Dashboard - Main Application (MongoDB Version)

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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupSlider();
  setupDateTime();
});

// Called after successful login
function initializeApp() {
  connectWebSocket();
  loadInitialData();
  loadHistory();
  startHistoryAutoRefresh();
}

// ============ WebSocket Connection ============
let pingInterval = null;

function connectWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  const wsUrl = `${CONFIG.WS_URL}/ws/${CONFIG.DEVICE_ID}`;
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
    const dateEl = document.getElementById('currentDate');
    
    if (timeEl) timeEl.textContent = `${hour12}:${minutes}`;
    if (periodEl) periodEl.textContent = period;
    if (dateEl) {
      const options = { weekday: 'short', month: 'short', day: 'numeric' };
      dateEl.textContent = now.toLocaleDateString('en-US', options);
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
  
  let greeting, subtext, iconClass, timeClass;
  
  if (hours >= 5 && hours < 12) {
    greeting = 'Good Morning!';
    subtext = 'Start your day safely';
    iconClass = 'fa-sun';
    timeClass = 'morning';
  } else if (hours >= 12 && hours < 17) {
    greeting = 'Good Afternoon!';
    subtext = 'Stay alert and safe';
    iconClass = 'fa-cloud-sun';
    timeClass = 'afternoon';
  } else if (hours >= 17 && hours < 21) {
    greeting = 'Good Evening!';
    subtext = 'Winding down safely';
    iconClass = 'fa-cloud-moon';
    timeClass = 'evening';
  } else {
    greeting = 'Good Night!';
    subtext = 'Rest easy, we\'re watching';
    iconClass = 'fa-moon';
    timeClass = 'night';
  }
  
  if (greetEl) greetEl.textContent = greeting;
  if (subEl) subEl.textContent = subtext;
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

// ============ Control Functions ============
async function saveThreshold() {
  const value = parseInt(elements.thresholdSlider.value);
  try {
    await api.sendCommand(CONFIG.DEVICE_ID, 'threshold', value);
    currentThreshold = value;
    showToast('Gas threshold saved: ' + value + '%');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function saveTempThreshold() {
  const value = parseInt(elements.tempThresholdSlider.value);
  try {
    await api.sendCommand(CONFIG.DEVICE_ID, 'tempThreshold', value);
    currentTempThreshold = value;
    showToast('Temp threshold saved: ' + value + '°C');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function silenceAlarm() {
  stopAlarmSound();
  try {
    await api.silenceAlarm(CONFIG.DEVICE_ID);
    showToast('Alarm silenced');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function toggleSiren() {
  const newState = !sirenEnabled;
  try {
    await api.sendCommand(CONFIG.DEVICE_ID, 'sirenEnabled', newState);
    sirenEnabled = newState;
    updateSirenUI();
    showToast('Siren ' + (newState ? 'enabled' : 'disabled'));
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function clearHistory() {
  if (confirm('Are you sure you want to clear all alarm history?')) {
    try {
      await api.clearHistory(CONFIG.DEVICE_ID);
      historyData = [];
      renderHistory([]);
      showToast('History cleared');
    } catch (error) {
      showToast('Error clearing history', 'error');
    }
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
  doc.text('CLOUD FIRE ALARM SYSTEM', 15, 13);
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text('Alarm History Report', 15, 20);
  doc.text('Generated: ' + formatDatePH(new Date()), 15, 25);
  
  // Table header
  let y = 42;
  doc.setFillColor(245, 245, 245);
  doc.rect(15, y - 6, pageW - 30, 8, 'F');
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.setFont(undefined, 'bold');
  doc.text('#', 20, y);
  doc.text('Date & Time (PH)', 35, y);
  doc.text('Trigger', 130, y);
  doc.text('Gas Level', 175, y);
  doc.text('Temperature', 225, y);
  
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
    doc.text((h.trigger || 'unknown').toUpperCase(), 130, y);
    doc.text((h.gas?.toFixed(1) || '--') + '%', 175, y);
    doc.text((h.temperature?.toFixed(1) || '--') + '°C', 225, y);
    
    y += 9;
  });
  
  // Footer
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${totalPages}`, pageW - 30, pageH - 10);
  }
  
  const filename = 'FireAlarm_History_' + new Date().toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }).replace(/\//g, '-') + '.pdf';
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

// ============ SMS Functions ============
async function saveSmsSettings() {
  const phone = document.getElementById('phoneInput').value.trim();
  const statusEl = document.getElementById('smsStatus');
  
  if (!phone) {
    statusEl.innerHTML = '<span class="error"><i class="fas fa-exclamation-circle"></i> Please enter a phone number</span>';
    return;
  }
  
  try {
    await api.request('/api/auth/phone', {
      method: 'PUT',
      body: JSON.stringify({ phoneNumber: phone, smsEnabled: true })
    });
    statusEl.innerHTML = '<span class="success"><i class="fas fa-check-circle"></i> SMS alerts enabled for ' + phone + '</span>';
    showToast('SMS settings saved!');
  } catch (error) {
    statusEl.innerHTML = '<span class="error"><i class="fas fa-exclamation-circle"></i> ' + error.message + '</span>';
  }
}

async function testSms() {
  const statusEl = document.getElementById('smsStatus');
  statusEl.innerHTML = '<span class="info"><i class="fas fa-spinner fa-spin"></i> Sending test SMS...</span>';
  
  try {
    await api.request('/api/auth/test-sms', { method: 'POST' });
    statusEl.innerHTML = '<span class="success"><i class="fas fa-check-circle"></i> Test SMS sent!</span>';
    showToast('Test SMS sent!');
  } catch (error) {
    statusEl.innerHTML = '<span class="error"><i class="fas fa-exclamation-circle"></i> ' + error.message + '</span>';
  }
}

async function loadUserPhone() {
  try {
    const data = await api.getMe();
    if (data.user && data.user.phoneNumber) {
      document.getElementById('phoneInput').value = data.user.phoneNumber;
      if (data.user.smsEnabled) {
        document.getElementById('smsStatus').innerHTML = '<span class="success"><i class="fas fa-check-circle"></i> SMS alerts enabled</span>';
      }
    }
  } catch (error) {
    console.log('Could not load phone settings');
  }
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

function saveAlarmSound() {
  const selected = document.querySelector('input[name="alarmSound"]:checked');
  if (selected) {
    selectedAlarmSound = selected.value;
    localStorage.setItem('alarmSound', selectedAlarmSound);
    
    // Update the alarm audio
    if (alarmAudio) {
      alarmAudio.src = selectedAlarmSound;
      alarmAudio.load();
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

// Override showMainApp to initialize app after login
const originalShowMainApp = showMainApp;
showMainApp = function() {
  originalShowMainApp();
  initializeApp();
  loadUserPhone();
  loadAlarmSoundSetting();
};


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
