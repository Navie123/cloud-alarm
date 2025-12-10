// Cloud Fire Alarm Dashboard - Main Application

const { jsPDF } = window.jspdf;

let sirenEnabled = true;
let currentThreshold = 40;
let currentTempThreshold = 60;
let isConnected = false;
let audioEnabled = false;
let alarmAudio = null;
let isPlaying = false;
let historyData = [];

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
  heapInfo: document.getElementById('heapInfo'),
  connectionStatus: document.getElementById('connectionStatus')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupSlider();
  setupDateTime();
  setupGreeting();
  subscribeToData();
  loadHistory();
});

// ============ Audio Functions ============
function enableAudio() {
  alarmAudio = new Audio('911.mp3');
  alarmAudio.loop = false; // Play once (15 seconds)
  alarmAudio.volume = 1.0;
  alarmAudio.preload = 'auto';
  alarmAudio.load();
  
  // When audio ends, allow replay if alarm still active
  alarmAudio.onended = function() {
    isPlaying = false;
    // Check if alarm is still active, replay
    if (document.body.classList.contains('alarm-mode') && sirenEnabled && audioEnabled) {
      setTimeout(() => playAlarmSound(), 500);
    }
  };
  
  audioEnabled = true;
  document.getElementById('audioPrompt').classList.add('hidden');
  console.log('Audio enabled - 911.mp3 loaded');
}

function playAlarmSound() {
  if (!sirenEnabled || !audioEnabled || isPlaying) return;
  if (!alarmAudio) {
    alarmAudio = new Audio('911.mp3');
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
  alarmAudio.play().then(() => console.log('Alarm sound playing')).catch(e => {
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

// ============ Fullscreen Functions ============
function toggleFullscreen() {
  document.body.classList.toggle('fullscreen');
  const btn = document.getElementById('fullscreenBtn');
  if (btn) {
    btn.querySelector('i').className = document.body.classList.contains('fullscreen') ? 'fas fa-compress' : 'fas fa-expand';
  }
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

// Get color level class based on gas percentage (5-95 range)
function getGasLevel(value) {
  if (value <= 20) return 'level-safe';
  if (value <= 35) return 'level-low';
  if (value <= 50) return 'level-medium';
  if (value <= 70) return 'level-high';
  if (value <= 85) return 'level-danger';
  return 'level-critical';
}

// Get color level class based on temperature (40-80 range)
function getTempLevel(value) {
  if (value <= 45) return 'level-safe';
  if (value <= 52) return 'level-low';
  if (value <= 60) return 'level-medium';
  if (value <= 68) return 'level-high';
  if (value <= 75) return 'level-danger';
  return 'level-critical';
}

// Update slider and value display colors
function updateSliderColors(slider, valueDisplay, level) {
  // Remove all level classes
  const levels = ['level-safe', 'level-low', 'level-medium', 'level-high', 'level-danger', 'level-critical'];
  levels.forEach(l => {
    slider.classList.remove(l);
    valueDisplay.classList.remove(l);
  });
  // Add current level
  slider.classList.add(level);
  valueDisplay.classList.add(level);
}

// Threshold Slider
function setupSlider() {
  // Gas threshold slider
  elements.thresholdSlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    const level = getGasLevel(value);
    elements.sliderValue.textContent = value + '%';
    updateSliderColors(elements.thresholdSlider, elements.sliderValue, level);
    
    // Sync sidebar
    const sideSlider = document.getElementById('sliderSide');
    const sideVal = document.getElementById('sliderValSide');
    if (sideSlider) {
      sideSlider.value = value;
      updateSliderColors(sideSlider, sideVal, level);
    }
    if (sideVal) sideVal.textContent = value + '%';
  });
  
  // Sidebar gas slider sync
  const sideSlider = document.getElementById('sliderSide');
  if (sideSlider) {
    sideSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      const level = getGasLevel(value);
      const sideVal = document.getElementById('sliderValSide');
      
      sideVal.textContent = value + '%';
      updateSliderColors(sideSlider, sideVal, level);
      
      elements.thresholdSlider.value = value;
      elements.sliderValue.textContent = value + '%';
      updateSliderColors(elements.thresholdSlider, elements.sliderValue, level);
    });
  }
  
  // Temperature threshold slider
  elements.tempThresholdSlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    const level = getTempLevel(value);
    elements.tempSliderValue.textContent = value + '°C';
    updateSliderColors(elements.tempThresholdSlider, elements.tempSliderValue, level);
    
    // Sync sidebar
    const tempSideSlider = document.getElementById('tempSliderSide');
    const tempSideVal = document.getElementById('tempSliderValSide');
    if (tempSideSlider) {
      tempSideSlider.value = value;
      updateSliderColors(tempSideSlider, tempSideVal, level);
    }
    if (tempSideVal) tempSideVal.textContent = value + '°C';
  });
  
  // Sidebar temp slider sync
  const tempSideSlider = document.getElementById('tempSliderSide');
  if (tempSideSlider) {
    tempSideSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      const level = getTempLevel(value);
      const tempSideVal = document.getElementById('tempSliderValSide');
      
      tempSideVal.textContent = value + '°C';
      updateSliderColors(tempSideSlider, tempSideVal, level);
      
      elements.tempThresholdSlider.value = value;
      elements.tempSliderValue.textContent = value + '°C';
      updateSliderColors(elements.tempThresholdSlider, elements.tempSliderValue, level);
    });
  }
  
  // Initialize colors on load
  setTimeout(() => {
    const gasLevel = getGasLevel(parseInt(elements.thresholdSlider.value));
    const tempLevel = getTempLevel(parseInt(elements.tempThresholdSlider.value));
    updateSliderColors(elements.thresholdSlider, elements.sliderValue, gasLevel);
    updateSliderColors(elements.tempThresholdSlider, elements.tempSliderValue, tempLevel);
    
    if (sideSlider) {
      const sideVal = document.getElementById('sliderValSide');
      updateSliderColors(sideSlider, sideVal, gasLevel);
    }
    if (tempSideSlider) {
      const tempSideVal = document.getElementById('tempSliderValSide');
      updateSliderColors(tempSideSlider, tempSideVal, tempLevel);
    }
  }, 100);
}

// Date/Time Display
function setupDateTime() {
  function update() {
    const now = new Date();
    document.getElementById('currentTime').textContent = now.toLocaleTimeString();
    document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }
  update();
  setInterval(update, 1000);
}

// Greeting based on time
function setupGreeting() {
  const hour = new Date().getHours();
  const icon = document.getElementById('greetIcon');
  const text = document.getElementById('greetText');
  
  if (hour < 12) {
    icon.className = 'fas fa-sun greeting-icon morning';
    text.textContent = 'Good Morning!';
  } else if (hour < 17) {
    icon.className = 'fas fa-sun greeting-icon afternoon';
    text.textContent = 'Good Afternoon!';
  } else if (hour < 20) {
    icon.className = 'fas fa-cloud-sun greeting-icon evening';
    text.textContent = 'Good Evening!';
  } else {
    icon.className = 'fas fa-moon greeting-icon night';
    text.textContent = 'Good Night!';
  }
}


// Subscribe to Firebase Real-time Data
function subscribeToData() {
  const deviceRef = database.ref(`/devices/${DEVICE_ID}/current`);
  
  deviceRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
      updateUI(data);
      setConnected(true);
    }
  }, (error) => {
    console.error('Firebase error:', error);
    setConnected(false);
  });

  // Monitor connection state
  database.ref('.info/connected').on('value', (snap) => {
    setConnected(snap.val() === true);
  });
}

// Update UI with sensor data
function updateUI(data) {
  // Gas level
  const gasPercent = Math.min(data.gas || 0, 100);
  elements.gasBar.style.height = gasPercent + '%';
  elements.gasVal.textContent = gasPercent.toFixed(1);
  
  // Temperature (scale 0-80°C to 0-100%)
  const temp = data.temperature || 0;
  const tempPercent = Math.min((temp / 80) * 100, 100);
  elements.tempBar.style.height = tempPercent + '%';
  elements.tempVal.textContent = temp.toFixed(1);
  
  // Humidity
  const humidity = Math.min(data.humidity || 0, 100);
  elements.humBar.style.height = humidity + '%';
  elements.humVal.textContent = humidity.toFixed(1);
  
  // Other values
  elements.voltVal.textContent = (data.voltage || 0).toFixed(2);
  elements.threshVal.textContent = data.threshold || '--';
  currentThreshold = data.threshold || 40;
  elements.thresholdSlider.value = currentThreshold;
  elements.sliderValue.textContent = currentThreshold + '%';
  
  // Update gas slider colors
  const gasLevel = getGasLevel(currentThreshold);
  updateSliderColors(elements.thresholdSlider, elements.sliderValue, gasLevel);
  
  // Temperature threshold
  elements.tempThreshVal.textContent = data.tempThreshold || '--';
  currentTempThreshold = data.tempThreshold || 60;
  elements.tempThresholdSlider.value = currentTempThreshold;
  elements.tempSliderValue.textContent = currentTempThreshold + '°C';
  
  // Update temp slider colors
  const tempLevel = getTempLevel(currentTempThreshold);
  updateSliderColors(elements.tempThresholdSlider, elements.tempSliderValue, tempLevel);
  
  // Siren state
  sirenEnabled = data.sirenEnabled !== false;
  updateSirenUI();
  
  // Alarm state
  updateAlarmState(data.alarm, data.tempWarning);
  
  // Device info
  elements.deviceId.textContent = DEVICE_ID;
  elements.lastUpdate.textContent = data.timestamp || '--';
  elements.heapInfo.textContent = ((data.heap || 0) / 1024).toFixed(1) + ' KB';
  elements.connectionStatus.textContent = 'Connected';
  elements.deviceStatus.textContent = 'Online';
  elements.deviceStatus.classList.add('online');
  
  // Update sidebar info
  updateSidebarInfo(data);
}

// Update alarm state UI
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
  
  // Temperature warning styling
  elements.alarmCard.classList.remove('temp-warning', 'temp-high', 'temp-critical');
  if (tempWarning && tempWarning !== 'normal') {
    elements.alarmCard.classList.add('temp-' + tempWarning);
  }
}

// Connection status
function setConnected(connected) {
  isConnected = connected;
  if (connected) {
    elements.connectionBanner.classList.remove('show');
    elements.status.innerHTML = '<i class="fas fa-check-circle"></i> Connected to Cloud';
  } else {
    elements.connectionBanner.classList.add('show');
    elements.status.innerHTML = '<i class="fas fa-exclamation-circle"></i> Disconnected';
    elements.deviceStatus.textContent = 'Offline';
    elements.deviceStatus.classList.remove('online');
  }
}

// Update siren UI
function updateSirenUI() {
  elements.sirenIcon.className = sirenEnabled ? 'fas fa-bell' : 'fas fa-bell-slash';
  elements.sirenText.textContent = sirenEnabled ? 'Siren On' : 'Siren Off';
  
  // Update sidebar siren button
  const sideIcon = document.getElementById('sirenIconSide');
  const sideText = document.getElementById('sirenTextSide');
  if (sideIcon) sideIcon.className = sirenEnabled ? 'fas fa-bell' : 'fas fa-bell-slash';
  if (sideText) sideText.textContent = sirenEnabled ? 'Siren On' : 'Siren Off';
  
  if (!sirenEnabled) stopAlarmSound();
}

// Load alarm history
function loadHistory() {
  const historyRef = database.ref(`/devices/${DEVICE_ID}/history`);
  
  historyRef.orderByChild('timestamp').limitToLast(50).on('value', (snapshot) => {
    const history = [];
    snapshot.forEach((child) => {
      history.unshift({ id: child.key, ...child.val() });
    });
    renderHistory(history);
  });
}

function refreshHistory() {
  loadHistory();
}

// Render history list
function renderHistory(history) {
  historyData = history; // Store for PDF export
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

// Save gas threshold to Firebase
function saveThreshold() {
  const value = parseInt(elements.thresholdSlider.value);
  database.ref(`/devices/${DEVICE_ID}/commands/threshold`).set(value)
    .then(() => {
      showToast('Gas threshold saved: ' + value + '%');
    })
    .catch((error) => {
      showToast('Error saving threshold', 'error');
      console.error(error);
    });
}

// Save temperature threshold to Firebase
function saveTempThreshold() {
  const value = parseInt(elements.tempThresholdSlider.value);
  database.ref(`/devices/${DEVICE_ID}/commands/tempThreshold`).set(value)
    .then(() => {
      showToast('Temp threshold saved: ' + value + '°C');
    })
    .catch((error) => {
      showToast('Error saving temp threshold', 'error');
      console.error(error);
    });
}

// Silence alarm
function silenceAlarm() {
  stopAlarmSound();
  database.ref(`/devices/${DEVICE_ID}/commands/silence`).set(true)
    .then(() => {
      showToast('Silence command sent');
    })
    .catch((error) => {
      showToast('Error sending command', 'error');
      console.error(error);
    });
}

// Toggle siren
function toggleSiren() {
  const newState = !sirenEnabled;
  database.ref(`/devices/${DEVICE_ID}/commands/sirenEnabled`).set(newState)
    .then(() => {
      sirenEnabled = newState;
      updateSirenUI();
      showToast('Siren ' + (newState ? 'enabled' : 'disabled'));
    })
    .catch((error) => {
      showToast('Error toggling siren', 'error');
      console.error(error);
    });
}

// Clear history
function clearHistory() {
  if (confirm('Are you sure you want to clear all alarm history?')) {
    database.ref(`/devices/${DEVICE_ID}/history`).remove()
      .then(() => {
        showToast('History cleared');
      })
      .catch((error) => {
        showToast('Error clearing history', 'error');
        console.error(error);
      });
  }
}

// Toast notification
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${message}`;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============ PDF Export ============
function exportPDF() {
  if (!historyData || historyData.length === 0) {
    showToast('No history to export', 'error');
    return;
  }
  
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'legal' });
  const pageW = 356, pageH = 216;
  
  // Header
  doc.setFillColor(255, 87, 34);
  doc.rect(0, 0, pageW, 25, 'F');
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  doc.text('CLOUD FIRE ALARM SYSTEM', 15, 12);
  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  doc.text('Alarm History Report', 15, 19);
  doc.setFontSize(9);
  doc.setTextColor(240, 240, 240);
  doc.text('Generated: ' + new Date().toLocaleString(), pageW - 15, 12, 'right');
  doc.text('Total Alarms: ' + historyData.length, pageW - 15, 19, 'right');
  
  // Table header
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
  doc.text('Status', 270, y);
  
  // Table rows
  y += 10;
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  
  historyData.forEach((h, i) => {
    if (y > pageH - 20) {
      doc.addPage();
      y = 20;
    }
    
    const rowColor = i % 2 === 0 ? [255, 255, 255] : [250, 250, 250];
    doc.setFillColor(...rowColor);
    doc.rect(15, y - 5, pageW - 30, 9, 'F');
    
    doc.setTextColor(40, 40, 40);
    doc.text(String(i + 1), 20, y);
    doc.text(h.timestamp || '--', 35, y);
    
    // Trigger with color
    let triggerText = h.trigger || 'unknown';
    let triggerColor = [100, 100, 100];
    if (h.trigger === 'gas') { triggerText = 'Gas Detected'; triggerColor = [245, 158, 11]; }
    else if (h.trigger === 'temperature') { triggerText = 'High Temperature'; triggerColor = [239, 68, 68]; }
    else if (h.trigger === 'both') { triggerText = 'Gas + Temperature'; triggerColor = [220, 38, 38]; }
    
    doc.setTextColor(...triggerColor);
    doc.setFont(undefined, 'bold');
    doc.text(triggerText, 120, y);
    
    doc.setFont(undefined, 'normal');
    doc.setTextColor(40, 40, 40);
    doc.text((h.gas?.toFixed(1) || '--') + '%', 165, y);
    
    const tempColor = h.temperature >= 65 ? [220, 38, 38] : h.temperature >= 60 ? [245, 158, 11] : [100, 100, 100];
    doc.setTextColor(...tempColor);
    doc.text((h.temperature?.toFixed(1) || '--') + '°C', 215, y);
    
    doc.setTextColor(220, 38, 38);
    doc.setFont(undefined, 'bold');
    doc.text('ALARM', 270, y);
    doc.setFont(undefined, 'normal');
    
    y += 9;
  });
  
  // Footer
  doc.setFillColor(50, 50, 50);
  doc.rect(0, pageH - 12, pageW, 12, 'F');
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text('Cloud Fire Alarm System © ' + new Date().getFullYear(), 15, pageH - 5);
  
  doc.save('FireAlarm_History_' + new Date().toISOString().split('T')[0] + '.pdf');
  showToast('PDF exported successfully');
}

// Update sidebar info
function updateSidebarInfo(data) {
  const deviceIdSide = document.getElementById('deviceIdSide');
  const lastUpdateSide = document.getElementById('lastUpdateSide');
  const heapSide = document.getElementById('heapSide');
  
  if (deviceIdSide) deviceIdSide.textContent = DEVICE_ID;
  if (lastUpdateSide) lastUpdateSide.textContent = data.timestamp || '--';
  if (heapSide) heapSide.textContent = ((data.heap || 0) / 1024).toFixed(1) + ' KB';
  
  // Sync gas slider
  const sideSlider = document.getElementById('sliderSide');
  const sideVal = document.getElementById('sliderValSide');
  const gasThresh = data.threshold || 40;
  if (sideSlider) sideSlider.value = gasThresh;
  if (sideVal) {
    sideVal.textContent = gasThresh + '%';
    const gasLevel = getGasLevel(gasThresh);
    updateSliderColors(sideSlider, sideVal, gasLevel);
  }
  
  // Sync temp slider
  const tempSideSlider = document.getElementById('tempSliderSide');
  const tempSideVal = document.getElementById('tempSliderValSide');
  const tempThresh = data.tempThreshold || 60;
  if (tempSideSlider) tempSideSlider.value = tempThresh;
  if (tempSideVal) {
    tempSideVal.textContent = tempThresh + '°C';
    const tempLevel = getTempLevel(tempThresh);
    updateSliderColors(tempSideSlider, tempSideVal, tempLevel);
  }
}
