// API Helper Functions - Household Auth System
const api = {
  get baseUrl() {
    return CONFIG.API_URL;
  },
  
  get token() {
    return localStorage.getItem('authToken');
  },

  get role() {
    return localStorage.getItem('userRole') || 'viewer';
  },

  get isAdmin() {
    return this.role === 'admin';
  },

  setAuth(token, role, deviceId, householdName) {
    if (token) {
      localStorage.setItem('authToken', token);
      localStorage.setItem('userRole', role || 'viewer');
      localStorage.setItem('deviceId', deviceId || '');
      localStorage.setItem('householdName', householdName || 'My Home');
    } else {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userRole');
      localStorage.removeItem('deviceId');
      localStorage.removeItem('householdName');
    }
  },

  async request(endpoint, options = {}) {
    const url = `${CONFIG.API_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Request failed');
    }

    return data;
  },

  // Household Auth endpoints
  async checkSetup(deviceId) {
    return this.request(`/api/household/check/${deviceId}`);
  },

  async setup(deviceId, householdName, accessCode, adminPin) {
    const data = await this.request('/api/household/setup', {
      method: 'POST',
      body: JSON.stringify({ deviceId, householdName, accessCode, adminPin })
    });
    this.setAuth(data.token, data.role, deviceId, data.householdName);
    return data;
  },

  async login(accessCode, adminPin = null) {
    const data = await this.request('/api/household/login', {
      method: 'POST',
      body: JSON.stringify({ accessCode, adminPin })
    });
    this.setAuth(data.token, data.role, data.deviceId, data.householdName);
    return data;
  },

  async upgradeToAdmin(adminPin) {
    const data = await this.request('/api/household/upgrade', {
      method: 'POST',
      body: JSON.stringify({ adminPin })
    });
    localStorage.setItem('userRole', 'admin');
    return data;
  },

  async getMe() {
    return this.request('/api/household/me');
  },

  async logout() {
    try {
      await this.request('/api/household/logout', { method: 'POST' });
    } catch (e) {
      // Ignore logout errors
    }
    this.setAuth(null);
  },

  // Admin-only settings
  async changeAccessCode(newAccessCode) {
    return this.request('/api/household/access-code', {
      method: 'PUT',
      body: JSON.stringify({ newAccessCode })
    });
  },

  async changeAdminPin(currentPin, newPin) {
    return this.request('/api/household/admin-pin', {
      method: 'PUT',
      body: JSON.stringify({ currentPin, newPin })
    });
  },

  async updateHouseholdName(name) {
    return this.request('/api/household/name', {
      method: 'PUT',
      body: JSON.stringify({ name })
    });
  },

  async updateSmsSettings(phoneNumber, enabled) {
    return this.request('/api/household/sms', {
      method: 'PUT',
      body: JSON.stringify({ phoneNumber, enabled })
    });
  },

  // Device endpoints
  async getDevice(deviceId) {
    return this.request(`/api/device/${deviceId}`);
  },

  async sendCommand(deviceId, command, value) {
    return this.request(`/api/device/${deviceId}/command`, {
      method: 'POST',
      body: JSON.stringify({ command, value })
    });
  },

  async silenceAlarm(deviceId) {
    return this.request(`/api/device/${deviceId}/silence`, {
      method: 'POST'
    });
  },

  async getHistory(deviceId) {
    return this.request(`/api/device/${deviceId}/history`);
  },

  async clearHistory(deviceId) {
    return this.request(`/api/device/${deviceId}/history`, {
      method: 'DELETE'
    });
  },

  // Push notifications
  async getVapidKey() {
    return this.request('/api/push/vapid-key');
  },

  async subscribePush(subscription) {
    return this.request('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ subscription })
    });
  },

  async unsubscribePush(endpoint) {
    return this.request('/api/push/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint })
    });
  }
};
