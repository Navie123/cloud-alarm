// Push Notifications Module

let pushSubscription = null;

// Initialize push notifications
async function initPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push notifications not supported');
    return;
  }

  try {
    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered');

    // Check if already subscribed
    pushSubscription = await registration.pushManager.getSubscription();
    
    if (pushSubscription) {
      console.log('Already subscribed to push');
      updatePushUI(true);
    } else {
      updatePushUI(false);
    }
  } catch (error) {
    console.error('Push init error:', error);
  }
}

// Subscribe to push notifications
async function subscribeToPush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Get VAPID public key from server
    const { publicKey } = await api.getVapidKey();
    
    // Convert VAPID key
    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    
    // Subscribe
    pushSubscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });

    // Send subscription to server
    await api.subscribePush(pushSubscription.toJSON());
    
    console.log('Push subscription successful');
    updatePushUI(true);
    showToast('Push notifications enabled!');
  } catch (error) {
    console.error('Push subscribe error:', error);
    if (error.name === 'NotAllowedError') {
      showToast('Please allow notifications in your browser settings', 'error');
    } else {
      showToast('Failed to enable notifications', 'error');
    }
  }
}

// Unsubscribe from push notifications
async function unsubscribeFromPush() {
  try {
    if (pushSubscription) {
      await api.unsubscribePush(pushSubscription.endpoint);
      await pushSubscription.unsubscribe();
      pushSubscription = null;
    }
    
    updatePushUI(false);
    showToast('Push notifications disabled');
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    showToast('Failed to disable notifications', 'error');
  }
}

// Toggle push notifications
function togglePushNotifications() {
  if (pushSubscription) {
    unsubscribeFromPush();
  } else {
    subscribeToPush();
  }
}

// Update push notification UI
function updatePushUI(subscribed) {
  const pushBtn = document.getElementById('pushToggleBtn');
  const pushIcon = document.getElementById('pushIcon');
  const pushText = document.getElementById('pushText');
  
  if (pushBtn) {
    if (subscribed) {
      pushBtn.classList.add('active');
      if (pushIcon) pushIcon.className = 'fas fa-bell';
      if (pushText) pushText.textContent = 'Notifications On';
    } else {
      pushBtn.classList.remove('active');
      if (pushIcon) pushIcon.className = 'fas fa-bell-slash';
      if (pushText) pushText.textContent = 'Enable Notifications';
    }
  }
}

// Convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
