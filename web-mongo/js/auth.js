// Authentication Module
let currentUser = null;

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
    currentUser = data.user;
    showMainApp();
    updateUserDisplay();
  } catch (error) {
    console.error('Auth check failed:', error);
    api.setAuth(null);
    showLoginScreen();
  }
}

// Login with email/password
async function loginUser() {
  const email = document.getElementById('emailInput').value.trim();
  const password = document.getElementById('passwordInput').value;
  const errorEl = document.getElementById('loginError');
  const loginBtn = document.querySelector('#loginForm button[type="submit"]');

  if (!email || !password) {
    errorEl.textContent = 'Please enter email and password';
    return;
  }

  errorEl.textContent = '';
  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';
  }

  try {
    const data = await api.login(email, password);
    currentUser = data.user;
    showMainApp();
    updateUserDisplay();
  } catch (error) {
    console.error('Login error:', error);
    errorEl.textContent = error.message;
  } finally {
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
    }
  }
}

// Register new user
async function registerUser() {
  const name = document.getElementById('nameInput').value.trim();
  const email = document.getElementById('regEmailInput').value.trim();
  const password = document.getElementById('regPasswordInput').value;
  const errorEl = document.getElementById('registerError');
  const registerBtn = document.querySelector('#registerForm button[type="submit"]');

  if (!name || !email || !password) {
    errorEl.textContent = 'Please fill in all fields';
    return;
  }

  if (password.length < 6) {
    errorEl.textContent = 'Password must be at least 6 characters';
    return;
  }

  errorEl.textContent = '';
  if (registerBtn) {
    registerBtn.disabled = true;
    registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';
  }

  try {
    const data = await api.register(name, email, password);
    currentUser = data.user;
    showMainApp();
    updateUserDisplay();
  } catch (error) {
    console.error('Register error:', error);
    errorEl.textContent = error.message;
  } finally {
    if (registerBtn) {
      registerBtn.disabled = false;
      registerBtn.innerHTML = '<i class="fas fa-user-plus"></i> Register';
    }
  }
}

// Logout
function logout() {
  api.logout();
  currentUser = null;
  showLoginScreen();
  
  if (window.ws) {
    window.ws.close();
  }
}

// Show/hide screens
function showLogin() {
  document.getElementById('loginForm')?.classList.remove('hidden');
  document.getElementById('registerForm')?.classList.add('hidden');
  document.querySelector('.login-title').textContent = 'Sign In';
  document.querySelector('.login-subtitle').textContent = 'Access your fire alarm dashboard';
}

function showRegister() {
  document.getElementById('loginForm')?.classList.add('hidden');
  document.getElementById('registerForm')?.classList.remove('hidden');
  document.querySelector('.login-title').textContent = 'Create Account';
  document.querySelector('.login-subtitle').textContent = 'Register to monitor your fire alarm';
}

function showMainApp() {
  document.getElementById('loginScreen').style.cssText = 'display: none !important;';
  document.getElementById('mainApp').style.cssText = 'display: block !important;';
  initPushNotifications();
}

function showLoginScreen() {
  document.getElementById('loginScreen').style.cssText = 'display: flex !important;';
  document.getElementById('mainApp').style.cssText = 'display: none !important;';
}

// Update user display
function updateUserDisplay() {
  const userInfoEl = document.getElementById('userInfo');
  const greetTextEl = document.getElementById('greetText');
  
  if (currentUser && userInfoEl) {
    const name = currentUser.name || 'User';
    userInfoEl.innerHTML = `
      <div class="user-avatar"><i class="fas fa-user"></i></div>
      <div class="user-details">
        <div class="user-name">${name}</div>
        <div class="user-email">${currentUser.email || ''}</div>
      </div>
    `;
    
    if (greetTextEl) {
      const hour = new Date().getHours();
      let greeting = 'Hello';
      if (hour < 12) greeting = 'Good Morning';
      else if (hour < 18) greeting = 'Good Afternoon';
      else greeting = 'Good Evening';
      
      greetTextEl.textContent = `${greeting}, ${name.split(' ')[0]}!`;
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
