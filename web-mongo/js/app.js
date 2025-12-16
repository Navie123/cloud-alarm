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
    document.getElementById('currentTime').textContent = now.toLocaleTimeString();
  }
  update();
  setInterval(update, 1000);
}

// Update UI with sensor data
function updateUI(data) {
  if (!data) return;
  
  const gasPercent = Math.min(data.gas || 0, 100);
  elements.gasBar.style.height = gasPercent + '%';
  elements.gasVal.textContent = gasPercent.toFixed(1);
  
  const temp = data.temperature || 0;
  const tempPercent = Math.min((temp / 80) * 100, 100);
  elements.tempBar.style.height = tempPercent + '%';
  elements.tempVal.textContent = temp.toFixed(1);
  
  const humidity = Math.min(data.humidity || 0, 100);
  elements.humBar.style.height = humidity + '%';
  elements.humVal.textContent = humidity.toFixed(1);
  
  elements.voltVal.textContent = (data.voltage || 0).toFixed(2);
  elements.threshVal.textContent = data.threshold || '--';
  
  if (!sliderActive) {
    currentThreshold = data.threshold || 40;
    elements.thresholdSlider.value = currentThreshold;
    elements.sliderValue.textContent = currentThreshold + '%';
    const gasLevel = getGasLevel(currentThreshold);
    updateSliderColors(elements.thresholdSlider, elements.sliderValue, gasLevel);
  }
  
  elements.tempThreshVal.textContent = data.tempThreshold || '--';
  
  if (!tempSliderActive) {
    currentTempThreshold = data.tempThreshold || 60;
    elements.tempThresholdSlider.value = currentTempThreshold;
    elements.tempSliderValue.textContent = currentTempThreshold + '°C';
    const tempLevel = getTempLevel(currentTempThreshold);
    updateSliderColors(elements.tempThresholdSlider, elements.tempSliderValue, tempLevel);
  }
  
  sirenEnabled = data.sirenEnabled !== false;
  updateSirenUI();
  
  updateAlarmState(data.alarm, data.tempWarning);
  
  elements.deviceId.textContent = CONFIG.DEVICE_ID;
  elements.lastUpdate.textContent = data.timestamp || '--';
  elements.connectionStatus.textContent = 'Connected';
  elements.deviceStatus.textContent = 'Online';
  elements.deviceStatus.classList.add('online');
  
  updateSidebarInfo(data);
}

function updateAlarmState(isAlarm, tempWarning) {
  if (isAlarm) {
    elements.alarmCard.classList.add('alarm-active');
    elements.alarmIcon.className = 'fas fa-triangle-exclamation';
    elements.alarmText.textContent = 'ALARM ACTIVE!';
    elements.sirenOverlay.classList.add('active');
    document.body.classList.add('alarm-mode');
    playAlarmSound();
  } else {
    elements.alarmCard.classList.remove('alarm-active');
    elements.alarmIcon.className = 'fas fa-shield-check';
    elements.alarmText.textContent = 'System Normal';
    elements.sirenOverlay.classList.remove('active');
    document.body.classList.remove('alarm-mode');
    stopAlarmSound();
  }
}

function setConnected(connected) {
  isConnected = connected;
  if (connected) {
    elements.connectionBanner.classList.remove('show');
    elements.status.innerHTML = '<i class="fas fa-check-circle"></i> Connected';
  } else {
    elements.connectionBanner.classList.add('show');
    elements.status.innerHTML = '<i class="fas fa-exclamation-circle"></i> Disconnected';
    elements.deviceStatus.textContent = 'Offline';
    elements.deviceStatus.classList.remove('online');
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
}

function renderHistory(history) {
  historyData = history;
  elements.historyCount.textContent = history.length;
  elements.alarmCount.textContent = history.length;
  
  if (history.length === 0) {
    elements.historyList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-check-circle"></i>
        <p>No alarm history</p>
      </div>`;
    return;
  }
  
  elements.historyList.innerHTML = history.map(item => `
    <div class="history-item">
      <div class="history-info">
        <span class="history-time"><i class="fas fa-clock"></i> ${item.timestamp}</span>
        <span class="history-trigger ${item.trigger}">${item.trigger.toUpperCase()}</span>
      </div>
      <div class="history-values">
        <span><i class="fas fa-fire"></i> ${item.gas?.toFixed(1) || '--'}%</span>
        <span><i class="fas fa-temperature-half"></i> ${item.temperature?.toFixed(1) || '--'}°C</span>
      </div>
    </div>
  `).join('');
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

function exportPDF() {
  if (!historyData || historyData.length === 0) {
    showToast('No history to export', 'error');
    return;
  }
  
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'legal' });
  const pageW = 356, pageH = 216;
  
  doc.setFillColor(255, 87, 34);
  doc.rect(0, 0, pageW, 25, 'F');
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  doc.text('CLOUD FIRE ALARM SYSTEM', 15, 12);
  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  doc.text('Alarm History Report', 15, 19);
  
  let y = 38;
  doc.setFillColor(245, 245, 245);
  doc.rect(15, y - 6, pageW - 30, 8, 'F');
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.setFont(undefined, 'bold');
  doc.text('#', 20, y);
  doc.text('Date & Time', 35, y);
  doc.text('Trigger', 120, y);
  doc.text('Gas Level', 165, y);
  doc.text('Temperature', 215, y);
  
  y += 10;
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  
  historyData.forEach((h, i) => {
    if (y > pageH - 20) {
      doc.addPage();
      y = 20;
    }
    
    doc.setTextColor(40, 40, 40);
    doc.text(String(i + 1), 20, y);
    doc.text(h.timestamp || '--', 35, y);
    doc.text(h.trigger || 'unknown', 120, y);
    doc.text((h.gas?.toFixed(1) || '--') + '%', 165, y);
    doc.text((h.temperature?.toFixed(1) || '--') + '°C', 215, y);
    
    y += 9;
  });
  
  doc.save('FireAlarm_History_' + new Date().toISOString().split('T')[0] + '.pdf');
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
