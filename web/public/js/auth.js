// Firebase Authentication
let currentUser = null;
let authInitialized = false;

// Hide main app immediately on page load
document.addEventListener("DOMContentLoaded", () => {
  const mainApp = document.getElementById("mainApp");
  const loginScreen = document.getElementById("loginScreen");
  if (mainApp) mainApp.style.display = "none";
  if (loginScreen) loginScreen.style.display = "flex";
});

// Initialize auth state listener
firebase.auth().onAuthStateChanged((user) => {
  authInitialized = true;
  if (user) {
    currentUser = user;
    // Check if email is verified
    if (user.emailVerified || user.providerData[0]?.providerId === "google.com") {
      showMainApp();
      updateUserDisplay();
      console.log("Logged in as:", user.email);
    } else {
      // Email not verified - show verification screen
      showVerificationScreen(user.email);
    }
  } else {
    currentUser = null;
    showLoginScreen();
  }
});

// Login with email/password
function loginUser() {
  const email = document.getElementById("emailInput").value.trim();
  const password = document.getElementById("passwordInput").value;
  const errorEl = document.getElementById("loginError");

  if (!email || !password) {
    errorEl.textContent = "Please enter email and password";
    return;
  }

  errorEl.textContent = "";

  firebase.auth().signInWithEmailAndPassword(email, password)
    .then((result) => {
      if (!result.user.emailVerified) {
        showVerificationScreen(result.user.email);
      }
    })
    .catch((error) => {
      console.error("Login error:", error);
      if (error.code === "auth/user-not-found") {
        errorEl.textContent = "No account found with this email";
      } else if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
        errorEl.textContent = "Incorrect email or password";
      } else if (error.code === "auth/invalid-email") {
        errorEl.textContent = "Invalid email address";
      } else {
        errorEl.textContent = error.message;
      }
    });
}

// Register new user with email verification
function registerUser() {
  const name = document.getElementById("nameInput").value.trim();
  const email = document.getElementById("regEmailInput").value.trim();
  const password = document.getElementById("regPasswordInput").value;
  const confirmPassword = document.getElementById("confirmPasswordInput")?.value || password;
  const errorEl = document.getElementById("registerError");

  if (!name || !email || !password) {
    errorEl.textContent = "Please fill in all fields";
    return;
  }

  if (password.length < 8) {
    errorEl.textContent = "Password must be at least 8 characters";
    return;
  }

  if (!/[A-Z]/.test(password)) {
    errorEl.textContent = "Password must contain at least one uppercase letter";
    return;
  }

  if (!/[0-9]/.test(password)) {
    errorEl.textContent = "Password must contain at least one number";
    return;
  }

  if (password !== confirmPassword) {
    errorEl.textContent = "Passwords do not match";
    return;
  }

  errorEl.textContent = "";

  firebase.auth().createUserWithEmailAndPassword(email, password)
    .then((result) => {
      // Update display name
      return result.user.updateProfile({ displayName: name })
        .then(() => {
          // Send verification email
          return result.user.sendEmailVerification();
        });
    })
    .then(() => {
      console.log("Registration successful, verification email sent");
      showVerificationScreen(email);
    })
    .catch((error) => {
      console.error("Registration error:", error);
      if (error.code === "auth/email-already-in-use") {
        errorEl.textContent = "Email already registered. Try signing in.";
      } else if (error.code === "auth/weak-password") {
        errorEl.textContent = "Password is too weak";
      } else if (error.code === "auth/invalid-email") {
        errorEl.textContent = "Invalid email address";
      } else {
        errorEl.textContent = error.message;
      }
    });
}

// Show verification screen
function showVerificationScreen(email) {
  const loginScreen = document.getElementById("loginScreen");
  const mainApp = document.getElementById("mainApp");
  const verifyScreen = document.getElementById("verifyScreen");
  
  if (loginScreen) loginScreen.style.cssText = "display: none !important;";
  if (mainApp) mainApp.style.cssText = "display: none !important;";
  if (verifyScreen) {
    verifyScreen.style.cssText = "display: flex !important;";
    const emailSpan = document.getElementById("verifyEmail");
    if (emailSpan) emailSpan.textContent = email;
  }
}

// Resend verification email
function resendVerification() {
  const user = firebase.auth().currentUser;
  if (user) {
    user.sendEmailVerification()
      .then(() => {
        alert("Verification email sent! Check your inbox.");
      })
      .catch((error) => {
        alert("Error sending email: " + error.message);
      });
  }
}

// Check verification status
function checkVerification() {
  const user = firebase.auth().currentUser;
  if (user) {
    user.reload().then(() => {
      if (user.emailVerified) {
        showMainApp();
        updateUserDisplay();
      } else {
        alert("Email not verified yet. Please check your inbox and click the verification link.");
      }
    });
  }
}

// Logout
function logout() {
  firebase.auth().signOut()
    .then(() => {
      console.log("Logged out");
      showLoginScreen();
    })
    .catch((error) => {
      console.error("Logout error:", error);
    });
}

// Show/hide forms
function showLogin() {
  document.getElementById("loginForm")?.classList.remove("hidden");
  document.getElementById("registerForm")?.classList.add("hidden");
  document.getElementById("forgotForm")?.classList.add("hidden");
  document.getElementById("loginScreen").style.cssText = "display: flex !important;";
  document.getElementById("verifyScreen")?.style.setProperty("display", "none", "important");
  // Reset title
  document.querySelector(".login-title").textContent = "Sign In";
  document.querySelector(".login-subtitle").textContent = "Access your fire alarm dashboard";
}

function showRegister() {
  document.getElementById("loginForm")?.classList.add("hidden");
  document.getElementById("registerForm")?.classList.remove("hidden");
  document.getElementById("forgotForm")?.classList.add("hidden");
  // Update title
  document.querySelector(".login-title").textContent = "Create Account";
  document.querySelector(".login-subtitle").textContent = "Register for fire alarm access";
}

function showForgotPassword() {
  document.getElementById("loginForm")?.classList.add("hidden");
  document.getElementById("registerForm")?.classList.add("hidden");
  document.getElementById("forgotForm")?.classList.remove("hidden");
  // Update title
  document.querySelector(".login-title").textContent = "Reset Password";
  document.querySelector(".login-subtitle").textContent = "We'll email you a reset link";
  // Clear previous messages
  document.getElementById("forgotError").textContent = "";
  document.getElementById("forgotSuccess").textContent = "";
}

// Send password reset email
function sendPasswordReset() {
  const email = document.getElementById("resetEmailInput").value.trim();
  const errorEl = document.getElementById("forgotError");
  const successEl = document.getElementById("forgotSuccess");
  
  errorEl.textContent = "";
  successEl.textContent = "";
  
  if (!email) {
    errorEl.textContent = "Please enter your email address";
    return;
  }
  
  firebase.auth().sendPasswordResetEmail(email)
    .then(() => {
      successEl.textContent = "Password reset email sent! Check your inbox.";
      document.getElementById("resetEmailInput").value = "";
    })
    .catch((error) => {
      console.error("Password reset error:", error);
      if (error.code === "auth/user-not-found") {
        errorEl.textContent = "No account found with this email";
      } else if (error.code === "auth/invalid-email") {
        errorEl.textContent = "Invalid email address";
      } else {
        errorEl.textContent = error.message;
      }
    });
}

// Show main app
function showMainApp() {
  const loginScreen = document.getElementById("loginScreen");
  const mainApp = document.getElementById("mainApp");
  const verifyScreen = document.getElementById("verifyScreen");
  
  if (loginScreen) loginScreen.style.cssText = "display: none !important;";
  if (verifyScreen) verifyScreen.style.cssText = "display: none !important;";
  if (mainApp) mainApp.style.cssText = "display: block !important;";
}

// Show login screen
function showLoginScreen() {
  const loginScreen = document.getElementById("loginScreen");
  const mainApp = document.getElementById("mainApp");
  const verifyScreen = document.getElementById("verifyScreen");
  
  if (loginScreen) loginScreen.style.cssText = "display: flex !important;";
  if (mainApp) mainApp.style.cssText = "display: none !important;";
  if (verifyScreen) verifyScreen.style.cssText = "display: none !important;";
}

// Update user display in sidebar
function updateUserDisplay() {
  const userInfoEl = document.getElementById("userInfo");
  if (userInfoEl && currentUser) {
    const name = currentUser.displayName || currentUser.email.split("@")[0];
    const initial = name.charAt(0).toUpperCase();
    userInfoEl.innerHTML = `
      <div class="user-avatar">${initial}</div>
      <div class="user-name">${name}</div>
    `;
  }
}

// Toggle password visibility
function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  const icon = btn.querySelector("i");
  if (input.type === "password") {
    input.type = "text";
    icon.className = "fas fa-eye-slash";
  } else {
    input.type = "password";
    icon.className = "fas fa-eye";
  }
}

// Google Sign In
function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider)
    .then((result) => {
      console.log("Google sign-in successful");
    })
    .catch((error) => {
      console.error("Google sign-in error:", error);
      const errorEl = document.getElementById("loginError");
      if (errorEl) errorEl.textContent = error.message;
    });
}


// Password strength checker
document.addEventListener("DOMContentLoaded", () => {
  const regPassword = document.getElementById("regPasswordInput");
  if (regPassword) {
    regPassword.addEventListener("input", checkPasswordStrength);
  }
});

function checkPasswordStrength() {
  const password = document.getElementById("regPasswordInput").value;
  const reqLength = document.getElementById("req-length");
  const reqUpper = document.getElementById("req-upper");
  const reqNumber = document.getElementById("req-number");

  if (reqLength) {
    if (password.length >= 8) {
      reqLength.classList.add("valid");
    } else {
      reqLength.classList.remove("valid");
    }
  }

  if (reqUpper) {
    if (/[A-Z]/.test(password)) {
      reqUpper.classList.add("valid");
    } else {
      reqUpper.classList.remove("valid");
    }
  }

  if (reqNumber) {
    if (/[0-9]/.test(password)) {
      reqNumber.classList.add("valid");
    } else {
      reqNumber.classList.remove("valid");
    }
  }
}
