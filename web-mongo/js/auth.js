// Authentication Module
let currentUser = null;

// Hide main app on load
document.addEventListener('DOMContentLoaded', () => {
  const mainApp = document.getElementById('mainApp');
  const loginScreen = document.getElementById('loginScreen');
  if (mainApp) mainApp.style.display = 'none';
  if (loginScreen) loginScreen.style.display = 'flex';
  
  // Check if already logged in
  checkAuthState();
  
  // Initialize Google Sign-In
  initGoogleSignIn();
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
    currentUser = data.user;
    showMainApp();
    updateUserDisplay();
  } catch (error) {
    console.error('Auth check failed:', error);
    api.logout();
    showLoginScreen();
  }
}

// Initialize Google Sign-In
function initGoogleSignIn() {
  // Load Google Identity Services
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  script.onload = () => {
    google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: handleGoogleCallback
    });
  };
  document.head.appendChild(script);
}

// Handle Google Sign-In callback
async function handleGoogleCallback(response) {
  try {
    const data = await api.googleLogin(response.credential);
    currentUser = data.user;
    showMainApp();
    updateUserDisplay();
    console.log('Google sign-in successful');
  } catch (error) {
    console.error('Google sign-in error:', error);
    document.getElementById('loginError').textContent = error.message;
  }
}

// Google Sign-In button click
function signInWithGoogle() {
  google.accounts.id.prompt((notification) => {
    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
      // Fallback to popup
      google.accounts.id.renderButton(
        document.createElement('div'),
        { theme: 'outline', size: 'large' }
      );
      google.accounts.id.prompt();
    }
  });
}

// Login with email/password
async function loginUser() {
  const email = document.getElementById('emailInput').value.trim();
  const password = document.getElementById('passwordInput').value;
  const errorEl = document.getElementById('loginError');

  if (!email || !password) {
    errorEl.textContent = 'Please enter email and password';
    return;
  }

  errorEl.textContent = '';

  try {
    const data = await api.login(email, password);
    currentUser = data.user;
    showMainApp();
    updateUserDisplay();
    console.log('Logged in as:', currentUser.email);
  } catch (error) {
    console.error('Login error:', error);
    if (error.message.includes('verify')) {
      showVerificationScreen(email);
    } else {
      errorEl.textContent = error.message;
    }
  }
}

// Register new user
async function registerUser() {
  const name = document.getElementById('nameInput').value.trim();
  const email = document.getElementById('regEmailInput').value.trim();
  const password = document.getElementById('regPasswordInput').value;
  const confirmPassword = document.getElementById('confirmPasswordInput')?.value || password;
  const errorEl = document.getElementById('registerError');

  if (!name || !email || !password) {
    errorEl.textContent = 'Please fill in all fields';
    return;
  }

  if (password.length < 8) {
    errorEl.textContent = 'Password must be at least 8 characters';
    return;
  }

  if (!/[A-Z]/.test(password)) {
    errorEl.textContent = 'Password must contain at least one uppercase letter';
    return;
  }

  if (!/[0-9]/.test(password)) {
    errorEl.textContent = 'Password must contain at least one number';
    return;
  }

  if (password !== confirmPassword) {
    errorEl.textContent = 'Passwords do not match';
    return;
  }

  errorEl.textContent = '';

  try {
    const data = await api.register(email, password, name);
    // If token returned, log in directly (auto-verified)
    if (data.token) {
      currentUser = data.user;
      showMainApp();
      updateUserDisplay();
    } else {
      showVerificationScreen(email);
    }
  } catch (error) {
    console.error('Registration error:', error);
    errorEl.textContent = error.message;
  }
}

// Show verification screen
function showVerificationScreen(email) {
  document.getElementById('loginScreen').style.cssText = 'display: none !important;';
  document.getElementById('mainApp').style.cssText = 'display: none !important;';
  document.getElementById('verifyScreen').style.cssText = 'display: flex !important;';
  document.getElementById('verifyEmail').textContent = email;
}

// Resend verification email
async function resendVerification() {
  const email = document.getElementById('verifyEmail').textContent;
  try {
    await api.resendVerification(email);
    alert('Verification email sent! Check your inbox.');
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

// Check verification (user clicks after verifying)
function checkVerification() {
  alert('Please check your email and click the verification link, then sign in.');
  showLogin();
}

// Logout
function logout() {
  api.logout();
  currentUser = null;
  showLoginScreen();
  
  // Disconnect WebSocket
  if (window.ws) {
    window.ws.close();
  }
}

// Show/hide forms
function showLogin() {
  document.getElementById('loginForm')?.classList.remove('hidden');
  document.getElementById('registerForm')?.classList.add('hidden');
  document.getElementById('forgotForm')?.classList.add('hidden');
  document.getElementById('loginScreen').style.cssText = 'display: flex !important;';
  document.getElementById('verifyScreen')?.style.setProperty('display', 'none', 'important');
  document.querySelector('.login-title').textContent = 'Sign In';
  document.querySelector('.login-subtitle').textContent = 'Access your fire alarm dashboard';
}

function showRegister() {
  document.getElementById('loginForm')?.classList.add('hidden');
  document.getElementById('registerForm')?.classList.remove('hidden');
  document.getElementById('forgotForm')?.classList.add('hidden');
  document.querySelector('.login-title').textContent = 'Create Account';
  document.querySelector('.login-subtitle').textContent = 'Register for fire alarm access';
}

function showForgotPassword() {
  document.getElementById('loginForm')?.classList.add('hidden');
  document.getElementById('registerForm')?.classList.add('hidden');
  document.getElementById('forgotForm')?.classList.remove('hidden');
  document.querySelector('.login-title').textContent = 'Reset Password';
  document.querySelector('.login-subtitle').textContent = "We'll email you a reset link";
  document.getElementById('forgotError').textContent = '';
  document.getElementById('forgotSuccess').textContent = '';
}

// Send password reset email
async function sendPasswordReset() {
  const email = document.getElementById('resetEmailInput').value.trim();
  const errorEl = document.getElementById('forgotError');
  const successEl = document.getElementById('forgotSuccess');

  errorEl.textContent = '';
  successEl.textContent = '';

  if (!email) {
    errorEl.textContent = 'Please enter your email address';
    return;
  }

  try {
    await api.forgotPassword(email);
    successEl.textContent = 'Password reset email sent! Check your inbox.';
    document.getElementById('resetEmailInput').value = '';
  } catch (error) {
    errorEl.textContent = error.message;
  }
}

// Show main app
function showMainApp() {
  document.getElementById('loginScreen').style.cssText = 'display: none !important;';
  document.getElementById('verifyScreen').style.cssText = 'display: none !important;';
  document.getElementById('mainApp').style.cssText = 'display: block !important;';
  
  // Initialize push notifications
  initPushNotifications();
}

// Show login screen
function showLoginScreen() {
  document.getElementById('loginScreen').style.cssText = 'display: flex !important;';
  document.getElementById('mainApp').style.cssText = 'display: none !important;';
  document.getElementById('verifyScreen').style.cssText = 'display: none !important;';
}

// Update user display
function updateUserDisplay() {
  const userInfoEl = document.getElementById('userInfo');
  const greetTextEl = document.getElementById('greetText');
  
  if (currentUser) {
    const name = currentUser.displayName || currentUser.email.split('@')[0];
    const firstName = name.split(' ')[0]; // Get first name only
    const initial = name.charAt(0).toUpperCase();
    
    // Update sidebar user info
    if (userInfoEl) {
      userInfoEl.innerHTML = `
        <div class="user-avatar">${initial}</div>
        <div class="user-name">${name}</div>
      `;
    }
    
    // Update greeting with time-based message and user's name
    if (greetTextEl) {
      const hour = new Date().getHours();
      let greeting = 'Hello';
      if (hour < 12) greeting = 'Good Morning';
      else if (hour < 18) greeting = 'Good Afternoon';
      else greeting = 'Good Evening';
      
      greetTextEl.textContent = `${greeting}, ${firstName}!`;
    }
  }
}

// Toggle password visibility
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

// Password strength checker
document.addEventListener('DOMContentLoaded', () => {
  const regPassword = document.getElementById('regPasswordInput');
  if (regPassword) {
    regPassword.addEventListener('input', checkPasswordStrength);
  }
});

function checkPasswordStrength() {
  const password = document.getElementById('regPasswordInput').value;
  const reqLength = document.getElementById('req-length');
  const reqUpper = document.getElementById('req-upper');
  const reqNumber = document.getElementById('req-number');

  if (reqLength) reqLength.classList.toggle('valid', password.length >= 8);
  if (reqUpper) reqUpper.classList.toggle('valid', /[A-Z]/.test(password));
  if (reqNumber) reqNumber.classList.toggle('valid', /[0-9]/.test(password));
}
