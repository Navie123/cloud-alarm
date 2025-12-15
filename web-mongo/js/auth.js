// Authentication Module - Household Access System
let currentHousehold = null;
let isAdmin = false;

// Hide main app on load
document.addEventListener('DOMContentLoaded', () => {
  const mainApp = document.getElementById('mainApp');
  const loginScreen = document.getElementById('loginScreen');
  if (mainApp) mainApp.style.display = 'none';
  if (loginScreen) loginScreen.style.display = 'flex';
  
  checkAuthState();
});

// Check authentication state
async function checkAuthState() {
  const token = localStorage.getItem('authToken');
  if (!token) {
    showLoginScreen();
    return;
  }

  try {
    const data = await api.getMe();
    currentHousehold = {
      name: data.householdName,
      deviceId: data.deviceId,
      role: data.role
    };
    isAdmin = data.isAdmin;
    showMainApp();
    updateUserDisplay();
  } catch (error) {
    console.error('Auth check failed:', error);
    api.setAuth(null);
    showLoginScreen();
  }
}

// Login with access code
async function loginUser() {
  const accessCode = document.getElementById('accessCodeInput').value.trim();
  const adminPin = document.getElementById('adminPinInput')?.value?.trim() || '';
  const errorEl = document.getElementById('loginError');
  const loginBtn = document.querySelector('#loginForm button[type="submit"]');

  if (!accessCode || accessCode.length !== 6) {
    errorEl.textContent = 'Please enter your 6-digit access code';
    return;
  }

  errorEl.textContent = '';
  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing In...';
  }

  try {
    const data = await api.login(accessCode, adminPin || null);
    currentHousehold = {
      name: data.householdName,
      deviceId: data.deviceId,
      role: data.role
    };
    isAdmin = data.role === 'admin';
    showMainApp();
    updateUserDisplay();
    console.log('Logged in as:', data.role);
  } catch (error) {
    console.error('Login error:', error);
    errorEl.textContent = error.message;
  } finally {
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Access Dashboard';
    }
  }
}

// Setup new household
async function setupHousehold() {
  const deviceId = document.getElementById('setupDeviceId').value.trim();
  const householdName = document.getElementById('setupHouseholdName').value.trim();
  const accessCode = document.getElementById('setupAccessCode').value.trim();
  const adminPin = document.getElementById('setupAdminPin').value.trim();
  const errorEl = document.getElementById('setupError');
  const setupBtn = document.querySelector('#setupForm button[type="submit"]');

  // Validation
  if (!deviceId) {
    errorEl.textContent = 'Device ID is required';
    return;
  }
  if (!/^\d{6}$/.test(accessCode)) {
    errorEl.textContent = 'Access code must be exactly 6 digits';
    return;
  }
  if (!/^\d{4}$/.test(adminPin)) {
    errorEl.textContent = 'Admin PIN must be exactly 4 digits';
    return;
  }

  errorEl.textContent = '';
  if (setupBtn) {
    setupBtn.disabled = true;
    setupBtn.textContent = 'Setting Up...';
  }

  try {
    const data = await api.setup(deviceId, householdName || 'My Home', accessCode, adminPin);
    currentHousehold = {
      name: data.householdName,
      deviceId: deviceId,
      role: 'admin'
    };
    isAdmin = true;
    showMainApp();
    updateUserDisplay();
    showToast('Household setup complete! You are now the admin.');
  } catch (error) {
    console.error('Setup error:', error);
    errorEl.textContent = error.message;
  } finally {
    if (setupBtn) {
      setupBtn.disabled = false;
      setupBtn.textContent = 'Complete Setup';
    }
  }
}

// Upgrade to admin
async function upgradeToAdmin() {
  const adminPin = prompt('Enter Admin PIN to access settings:');
  if (!adminPin) return;

  try {
    await api.upgradeToAdmin(adminPin);
    isAdmin = true;
    updateUserDisplay();
    updateAdminUI();
    showToast('Upgraded to admin access!');
  } catch (error) {
    showToast('Invalid admin PIN', 'error');
  }
}

// Logout
function logout() {
  api.logout();
  currentHousehold = null;
  isAdmin = false;
  showLoginScreen();
  
  if (window.ws) {
    window.ws.close();
  }
}

// Show/hide screens
function showLogin() {
  document.getElementById('loginForm')?.classList.remove('hidden');
  document.getElementById('setupForm')?.classList.add('hidden');
  document.querySelector('.login-title').textContent = 'Access Dashboard';
  document.querySelector('.login-subtitle').textContent = 'Enter your household access code';
}

function showSetup() {
  document.getElementById('loginForm')?.classList.add('hidden');
  document.getElementById('setupForm')?.classList.remove('hidden');
  document.querySelector('.login-title').textContent = 'Setup New Device';
  document.querySelector('.login-subtitle').textContent = 'Configure your fire alarm system';
}

function showMainApp() {
  document.getElementById('loginScreen').style.cssText = 'display: none !important;';
  document.getElementById('mainApp').style.cssText = 'display: block !important;';
  
  // Update CONFIG with the device ID
  if (currentHousehold?.deviceId) {
    CONFIG.DEVICE_ID = currentHousehold.deviceId;
  }
  
  initPushNotifications();
  updateAdminUI();
}

function showLoginScreen() {
  document.getElementById('loginScreen').style.cssText = 'display: flex !important;';
  document.getElementById('mainApp').style.cssText = 'display: none !important;';
}

// Update UI based on role
function updateUserDisplay() {
  const userInfoEl = document.getElementById('userInfo');
  const greetTextEl = document.getElementById('greetText');
  const roleIndicator = document.getElementById('roleIndicator');
  
  if (currentHousehold) {
    const name = currentHousehold.name || 'My Home';
    const role = isAdmin ? 'Admin' : 'Viewer';
    
    if (userInfoEl) {
      userInfoEl.innerHTML = `
        <div class="user-avatar"><i class="fas fa-home"></i></div>
        <div class="user-details">
          <div class="user-name">${name}</div>
          <div class="user-role ${isAdmin ? 'admin' : 'viewer'}">${role}</div>
        </div>
      `;
    }
    
    if (greetTextEl) {
      const hour = new Date().getHours();
      let greeting = 'Hello';
      if (hour < 12) greeting = 'Good Morning';
      else if (hour < 18) greeting = 'Good Afternoon';
      else greeting = 'Good Evening';
      
      greetTextEl.textContent = `${greeting}!`;
    }

    if (roleIndicator) {
      roleIndicator.textContent = role;
      roleIndicator.className = `role-badge ${isAdmin ? 'admin' : 'viewer'}`;
    }
  }
}

// Show/hide admin-only controls
function updateAdminUI() {
  const adminOnlyElements = document.querySelectorAll('.admin-only');
  const viewerElements = document.querySelectorAll('.viewer-upgrade');
  
  adminOnlyElements.forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });
  
  viewerElements.forEach(el => {
    el.style.display = isAdmin ? 'none' : '';
  });

  // Disable admin-only inputs for viewers
  const adminInputs = document.querySelectorAll('.admin-input');
  adminInputs.forEach(input => {
    input.disabled = !isAdmin;
    if (!isAdmin) {
      input.title = 'Admin access required';
    }
  });
}

// Toggle password/PIN visibility
function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  const icon = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fas fa-eye-slash';
  } else {
    input.type = 'password';
    icon.className = 'fas fa-eye';
  }
}
