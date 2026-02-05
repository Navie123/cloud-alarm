// FireWire - Authentication Module
// Supports: First-time setup, Household access, Admin login

let accessType = null; // 'household' or 'admin'
let householdName = null;
let memberId = localStorage.getItem('memberId');
let setupEmail = null;

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', async () => {
  await checkSetupStatus();
});

async function checkSetupStatus() {
  try {
    // Check if setup is needed
    const { needsSetup } = await api.request('/api/household/check-setup');
    
    if (needsSetup) {
      showSetupScreen();
      initGoogleSetup();
      return;
    }
    
    // Check for existing session
    const token = localStorage.getItem('householdToken');
    if (token) {
      try {
        const info = await api.getHouseholdInfo();
        accessType = info.accessType;
        householdName = info.name;
        showMainApp();
        return;
      } catch (e) {
        localStorage.removeItem('householdToken');
      }
    }
    
    showAccessScreen();
  } catch (error) {
    console.error('Setup check failed:', error);
    showAccessScreen();
  }
}

// ============ SCREEN MANAGEMENT ============
function showSetupScreen() {
  document.getElementById('setupScreen').classList.remove('hidden');
  document.getElementById('accessScreen').classList.add('hidden');
  document.getElementById('mainApp').classList.add('hidden');
}

function showAccessScreen() {
  document.getElementById('setupScreen').classList.add('hidden');
  document.getElementById('accessScreen').classList.remove('hidden');
  document.getElementById('mainApp').classList.add('hidden');
  clearAccessForms();
}

function showMainApp() {
  document.getElementById('setupScreen').classList.add('hidden');
  document.getElementById('accessScreen').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  
  updateAccessUI();
  if (typeof initializeApp === 'function') initializeApp();
}

// ============ FIRST-TIME SETUP ============
function initGoogleSetup() {
  if (typeof google === 'undefined') {
    setTimeout(initGoogleSetup, 500);
    return;
  }
  
  google.accounts.id.initialize({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    callback: handleGoogleSetup
  });
  
  google.accounts.id.renderButton(
    document.getElementById('googleSetupBtn'),
    { theme: 'filled_black', size: 'large', text: 'continue_with', width: 280 }
  );
}

async function handleGoogleSetup(response) {
  const errorEl = document.getElementById('setupError');
  errorEl.textContent = '';
  
  try {
    const result = await api.request('/api/household/setup/google', {
      method: 'POST',
      body: JSON.stringify({ credential: response.credential })
    });
    
    setupEmail = result.email;
    document.getElementById('setupEmail').textContent = result.email;
    
    // Move to step 2
    document.getElementById('setupStep1').classList.add('hidden');
    document.getElementById('setupStep2').classList.remove('hidden');
    document.getElementById('setupOtpInput').focus();
    
    // Update step indicators
    document.getElementById('stepIndicator1').classList.remove('active');
    document.getElementById('stepIndicator1').classList.add('completed');
    document.getElementById('stepIndicator2').classList.add('active');
  } catch (error) {
    errorEl.textContent = error.message;
  }
}

async function verifySetupOTP() {
  const code = document.getElementById('setupOtpInput').value.trim();
  const errorEl = document.getElementById('otpError');
  errorEl.textContent = '';
  
  if (code.length !== 6) {
    errorEl.textContent = 'Please enter the 6-digit code';
    return;
  }
  
  try {
    await api.request('/api/household/setup/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email: setupEmail, code })
    });
    
    // Move to step 3
    document.getElementById('setupStep2').classList.add('hidden');
    document.getElementById('setupStep3').classList.remove('hidden');
    
    // Update step indicators
    document.getElementById('stepIndicator2').classList.remove('active');
    document.getElementById('stepIndicator2').classList.add('completed');
    document.getElementById('stepIndicator3').classList.add('active');
  } catch (error) {
    errorEl.textContent = error.message;
  }
}

async function resendSetupOTP() {
  try {
    await api.request('/api/household/setup/google', {
      method: 'POST',
      body: JSON.stringify({ credential: null, email: setupEmail, resend: true })
    });
    alert('New code sent to ' + setupEmail);
  } catch (error) {
    alert('Failed to resend code');
  }
}

async function completeSetup() {
  const householdName = document.getElementById('setupHouseholdName').value.trim();
  const adminPin = document.getElementById('setupAdminPin').value.trim();
  const accessCode = document.getElementById('setupAccessCode').value.trim();
  const deviceId = document.getElementById('setupDeviceId').value.trim();
  const errorEl = document.getElementById('setupCompleteError');
  errorEl.textContent = '';
  
  if (!/^\d{4,6}$/.test(adminPin)) {
    errorEl.textContent = 'Admin PIN must be 4-6 digits';
    return;
  }
  
  if (!/^\d{6}$/.test(accessCode)) {
    errorEl.textContent = 'Access code must be 6 digits';
    return;
  }
  
  try {
    const result = await api.request('/api/household/setup/complete', {
      method: 'POST',
      body: JSON.stringify({
        email: setupEmail,
        householdName: householdName || 'My Household',
        adminPin,
        accessCode,
        deviceId: deviceId || null
      })
    });
    
    // Show success and credentials
    showSetupCompleteModal(result, accessCode);
    
    // Send setup completion email
    await sendSetupCompletionEmail(result, accessCode);
    
    // Redirect to access screen
    showAccessScreen();
  } catch (error) {
    errorEl.textContent = error.message;
  }
}

// ============ ACCESS TABS ============
function showAccessTab(tab) {
  document.querySelectorAll('.access-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.access-tab:${tab === 'household' ? 'first-child' : 'last-child'}`).classList.add('active');
  
  if (tab === 'household') {
    document.getElementById('householdForm').classList.remove('hidden');
    document.getElementById('adminForm').classList.add('hidden');
  } else {
    document.getElementById('householdForm').classList.add('hidden');
    document.getElementById('adminForm').classList.remove('hidden');
    showAdminStep1();
  }
}

function showAdminStep1() {
  document.getElementById('adminStep1').classList.remove('hidden');
  document.getElementById('adminStep2').classList.add('hidden');
  
  // Reset step 2 UI
  skipOTPMode = false;
  document.getElementById('adminOtpInput').value = '';
  document.getElementById('adminPinInput').value = '';
  document.getElementById('adminOtpGroup').classList.remove('hidden');
  document.getElementById('trustedDeviceMsg').classList.add('hidden');
  document.getElementById('rememberDeviceGroup').classList.remove('hidden');
}

// ============ HOUSEHOLD ACCESS ============
async function joinHousehold() {
  const householdId = document.getElementById('householdIdInput').value.trim();
  const accessCode = document.getElementById('accessCodeInput').value.trim();
  const memberName = document.getElementById('memberNameInput').value.trim();
  const errorEl = document.getElementById('householdError');
  errorEl.textContent = '';
  
  if (householdId.length !== 10) {
    errorEl.textContent = 'Household ID must be 10 digits';
    return;
  }
  
  if (accessCode.length !== 6) {
    errorEl.textContent = 'Access code must be 6 digits';
    return;
  }
  
  try {
    if (!memberId) {
      memberId = 'member_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('memberId', memberId);
    }
    
    const result = await api.joinHousehold(householdId, accessCode, memberName);
    
    accessType = result.accessType;
    householdName = result.householdName;
    localStorage.setItem('householdName', householdName);
    
    // Save member name for greeting
    if (memberName) {
      localStorage.setItem('memberName', memberName);
    }
    
    if (result.devices?.length > 0) {
      localStorage.setItem('deviceId', result.devices[0].deviceId);
    }
    
    showMainApp();
  } catch (error) {
    errorEl.textContent = error.message;
  }
}

// ============ ADMIN LOGIN ============
let adminLoginData = {};
let skipOTPMode = false;

async function requestAdminOTP() {
  const householdId = document.getElementById('adminHouseholdId').value.trim();
  const email = document.getElementById('adminEmail').value.trim();
  const errorEl = document.getElementById('adminError1');
  errorEl.textContent = '';
  
  if (!householdId || !email) {
    errorEl.textContent = 'Please fill in all fields';
    return;
  }
  
  try {
    // Check for trusted device token
    const trustedToken = localStorage.getItem('adminTrustedToken');
    
    const result = await api.request('/api/household/admin/request-otp', {
      method: 'POST',
      body: JSON.stringify({ householdId, email, trustedToken })
    });
    
    adminLoginData = { householdId, email };
    skipOTPMode = result.skipOTP;
    
    document.getElementById('adminStep1').classList.add('hidden');
    document.getElementById('adminStep2').classList.remove('hidden');
    
    if (result.skipOTP) {
      // Trusted device - hide OTP field, show message
      document.getElementById('adminOtpGroup').classList.add('hidden');
      document.getElementById('trustedDeviceMsg').classList.remove('hidden');
      document.getElementById('trustedDeviceName').textContent = result.deviceName || 'this device';
      document.getElementById('rememberDeviceGroup').classList.add('hidden');
      document.getElementById('adminPinInput').focus();
    } else {
      // Need OTP
      document.getElementById('adminOtpGroup').classList.remove('hidden');
      document.getElementById('trustedDeviceMsg').classList.add('hidden');
      document.getElementById('rememberDeviceGroup').classList.remove('hidden');
      document.getElementById('adminOtpInput').focus();
    }
  } catch (error) {
    errorEl.textContent = error.message;
  }
}

async function adminLogin() {
  const code = document.getElementById('adminOtpInput').value.trim();
  const pin = document.getElementById('adminPinInput').value.trim();
  const rememberDevice = document.getElementById('rememberDeviceCheck')?.checked || false;
  const errorEl = document.getElementById('adminError2');
  errorEl.textContent = '';
  
  if (!skipOTPMode && !code) {
    errorEl.textContent = 'Please enter verification code';
    return;
  }
  
  if (!pin) {
    errorEl.textContent = 'Please enter your PIN';
    return;
  }
  
  try {
    const trustedToken = localStorage.getItem('adminTrustedToken');
    
    const result = await api.request('/api/household/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        householdId: adminLoginData.householdId,
        email: adminLoginData.email,
        code: skipOTPMode ? null : code,
        pin,
        trustedToken: skipOTPMode ? trustedToken : null,
        rememberDevice,
        deviceName: getBrowserName()
      })
    });
    
    api.setToken(result.token);
    accessType = 'admin';
    householdName = result.householdName;
    localStorage.setItem('householdName', householdName);
    
    // Save trusted device token if provided
    if (result.trustedToken) {
      localStorage.setItem('adminTrustedToken', result.trustedToken);
    }
    
    // Save admin name from email (use part before @)
    const adminName = adminLoginData.email.split('@')[0];
    localStorage.setItem('memberName', adminName.charAt(0).toUpperCase() + adminName.slice(1));
    
    if (result.devices?.length > 0) {
      localStorage.setItem('deviceId', result.devices[0].deviceId);
    }
    
    showMainApp();
  } catch (error) {
    errorEl.textContent = error.message;
  }
}

// Get browser name for trusted device
function getBrowserName() {
  const ua = navigator.userAgent;
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Edge')) return 'Edge';
  return 'Browser';
}

// ============ UI UPDATES ============
function updateAccessUI() {
  const householdDisplay = document.getElementById('householdNameDisplay');
  const accessTypeDisplay = document.getElementById('accessTypeDisplay');
  const greetSub = document.getElementById('greetSub');
  
  if (householdDisplay) householdDisplay.textContent = householdName || '--';
  if (accessTypeDisplay) accessTypeDisplay.textContent = accessType === 'admin' ? 'Admin' : 'Household';
  if (greetSub) greetSub.textContent = householdName || '--';
  
  // Show/hide admin-only elements
  const adminElements = document.querySelectorAll('.admin-only');
  adminElements.forEach(el => {
    el.style.display = accessType === 'admin' ? '' : 'none';
  });
}

function clearAccessForms() {
  document.getElementById('householdIdInput').value = '';
  document.getElementById('accessCodeInput').value = '';
  document.getElementById('memberNameInput').value = '';
  document.getElementById('adminHouseholdId').value = '';
  document.getElementById('adminEmail').value = '';
  document.getElementById('adminOtpInput').value = '';
  document.getElementById('adminPinInput').value = '';
  
  // Reset trusted device UI
  skipOTPMode = false;
  const rememberCheck = document.getElementById('rememberDeviceCheck');
  if (rememberCheck) rememberCheck.checked = false;
  
  showAccessTab('household');
}

// ============ LOGOUT ============
function logout() {
  api.logout();
  accessType = null;
  householdName = null;
  localStorage.removeItem('householdName');
  localStorage.removeItem('memberName');
  
  if (window.ws) window.ws.close();
  
  showAccessScreen();
}

// ============ HELPERS ============
function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  const btn = input.parentElement.querySelector('.toggle-password i');
  if (input.type === 'password') {
    input.type = 'text';
    btn.className = 'fas fa-eye-slash';
  } else {
    input.type = 'password';
    btn.className = 'fas fa-eye';
  }
}

function isAdmin() {
  return accessType === 'admin';
}

function getMemberId() {
  return memberId;
}

// ============ FACTORY RESET ============
function showFactoryResetModal() {
  const modal = document.getElementById('factoryResetModal');
  modal.classList.remove('hidden');
  document.getElementById('resetPinInput').value = '';
  document.getElementById('resetConfirmInput').value = '';
  
  // Add click handler to modal overlay to close modal
  const overlay = modal.querySelector('.modal-overlay');
  overlay.onclick = hideFactoryResetModal;
  
  // Add escape key handler
  document.addEventListener('keydown', handleFactoryResetEscape);
  
  // Focus on PIN input
  setTimeout(() => {
    document.getElementById('resetPinInput').focus();
  }, 100);
}

function hideFactoryResetModal() {
  const modal = document.getElementById('factoryResetModal');
  modal.classList.add('hidden');
  
  // Remove escape key handler
  document.removeEventListener('keydown', handleFactoryResetEscape);
}

function handleFactoryResetEscape(event) {
  if (event.key === 'Escape') {
    hideFactoryResetModal();
  }
}

async function performFactoryReset() {
  const pin = document.getElementById('resetPinInput').value.trim();
  const confirmText = document.getElementById('resetConfirmInput').value.trim();
  
  if (!pin) {
    showToast('Please enter your Admin PIN', 'error');
    document.getElementById('resetPinInput').focus();
    return;
  }
  
  if (confirmText !== 'RESET') {
    showToast('Please type exactly "RESET" in the confirmation field', 'error');
    document.getElementById('resetConfirmInput').focus();
    document.getElementById('resetConfirmInput').select();
    return;
  }
  
  // Show FireWire-styled confirmation modal instead of browser alert
  showFinalConfirmation();
}

function showFinalConfirmation() {
  // Create custom confirmation overlay
  const confirmOverlay = document.createElement('div');
  confirmOverlay.className = 'final-confirm-overlay';
  confirmOverlay.innerHTML = `
    <div class="final-confirm-modal">
      <div class="final-confirm-header">
        <i class="fas fa-exclamation-triangle"></i>
        <h3>⚠️ FINAL WARNING ⚠️</h3>
      </div>
      <div class="final-confirm-body">
        <p>This will <strong>permanently delete ALL data</strong> and cannot be undone.</p>
        <p>Are you absolutely sure you want to proceed?</p>
      </div>
      <div class="final-confirm-actions">
        <button class="btn btn-secondary" onclick="cancelFinalConfirmation()">
          <i class="fas fa-times"></i> Cancel
        </button>
        <button class="btn btn-danger" onclick="executeFinalReset()">
          <i class="fas fa-trash-can"></i> Yes, Delete Everything
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(confirmOverlay);
  
  // Add to global scope for cleanup
  window.currentConfirmOverlay = confirmOverlay;
}

function cancelFinalConfirmation() {
  if (window.currentConfirmOverlay) {
    document.body.removeChild(window.currentConfirmOverlay);
    window.currentConfirmOverlay = null;
  }
}

async function executeFinalReset() {
  // Remove confirmation overlay
  cancelFinalConfirmation();
  
  const pin = document.getElementById('resetPinInput').value.trim();
  const confirmText = document.getElementById('resetConfirmInput').value.trim();
  
  try {
    // Disable the button to prevent double-clicks
    const resetButton = document.querySelector('.modal-footer .btn-danger');
    resetButton.disabled = true;
    resetButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting...';
    
    const result = await api.request('/api/household/admin/factory-reset', {
      method: 'POST',
      body: JSON.stringify({ pin, confirmText })
    });
    
    // Clear all local storage
    localStorage.clear();
    
    // Close WebSocket
    if (window.ws) window.ws.close();
    
    // Show success message with FireWire styling
    showToast('Factory reset complete! Redirecting to setup...', 'success');
    
    // Hide the modal
    hideFactoryResetModal();
    
    // Reload page to go to setup after a short delay
    setTimeout(() => {
      window.location.reload();
    }, 2000);
    
  } catch (error) {
    // Re-enable button on error
    const resetButton = document.querySelector('.modal-footer .btn-danger');
    if (resetButton) {
      resetButton.disabled = false;
      resetButton.innerHTML = '<i class="fas fa-trash-can"></i> Reset Everything';
    }
    
    showToast('Factory reset failed: ' + error.message, 'error');
  }
}

// ============ SETUP COMPLETION ============
function showSetupCompleteModal(result, accessCode) {
  // Create setup completion modal
  const modal = document.createElement('div');
  modal.className = 'setup-complete-overlay';
  modal.innerHTML = `
    <div class="setup-complete-modal">
      <div class="setup-complete-header">
        <i class="fas fa-check-circle"></i>
        <h2>🎉 Welcome to FireWire!</h2>
        <p>Your smart fire monitoring system is ready</p>
      </div>
      <div class="setup-complete-body">
        <div class="credentials-section">
          <h3><i class="fas fa-key"></i> Your Login Credentials</h3>
          <div class="credential-item">
            <label>Household ID:</label>
            <div class="credential-value">
              <span id="householdIdValue">${result.householdId}</span>
              <button class="copy-btn" onclick="copyToClipboard('householdIdValue')">
                <i class="fas fa-copy"></i>
              </button>
            </div>
          </div>
          <div class="credential-item">
            <label>Access Code:</label>
            <div class="credential-value">
              <span id="accessCodeValue">${accessCode}</span>
              <button class="copy-btn" onclick="copyToClipboard('accessCodeValue')">
                <i class="fas fa-copy"></i>
              </button>
            </div>
          </div>
          ${result.deviceSecret ? `
          <div class="credential-item">
            <label>Device Secret:</label>
            <div class="credential-value">
              <span id="deviceSecretValue">${result.deviceSecret}</span>
              <button class="copy-btn" onclick="copyToClipboard('deviceSecretValue')">
                <i class="fas fa-copy"></i>
              </button>
            </div>
          </div>
          ` : ''}
        </div>
        <div class="email-notification">
          <i class="fas fa-envelope"></i>
          <p>These credentials have been sent to your email for safekeeping</p>
        </div>
        <div class="important-note">
          <i class="fas fa-exclamation-triangle"></i>
          <p><strong>Important:</strong> Save these credentials! You'll need them to access your FireWire dashboard.</p>
        </div>
      </div>
      <div class="setup-complete-footer">
        <button class="btn btn-primary btn-large" onclick="proceedToDashboard()">
          <i class="fas fa-rocket"></i> Launch My Fire Alarm
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  window.currentSetupModal = modal;
}

async function sendSetupCompletionEmail(result, accessCode) {
  try {
    await api.request('/api/household/setup/send-credentials', {
      method: 'POST',
      body: JSON.stringify({
        householdId: result.householdId,
        accessCode: accessCode,
        deviceSecret: result.deviceSecret
      })
    });
  } catch (error) {
    console.error('Failed to send setup email:', error);
    // Don't block the setup process if email fails
  }
}

function copyToClipboard(elementId) {
  const element = document.getElementById(elementId);
  const text = element.textContent;
  
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied to clipboard!', 'success');
  }).catch(() => {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showToast('Copied to clipboard!', 'success');
  });
}

function proceedToDashboard() {
  if (window.currentSetupModal) {
    document.body.removeChild(window.currentSetupModal);
    window.currentSetupModal = null;
  }
  
  // Redirect to access screen
  window.location.reload();
}