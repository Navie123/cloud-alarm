// API Helper Functions
const api = {
  get baseUrl() {
    return CONFIG.API_URL;
  },
  
  get token() {
    return localStorage.getItem('authToken');
  },

  setAuth(token) {
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
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

  // Auth endpoints
  async register(name, email, password) {
    const data = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    this.setAuth(data.token);
    return data;
  },

  async login(email, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.setAuth(data.token);
    return data;
  },

  async getMe() {
    return this.request('/api/auth/me');
  },

  logout() {
    this.setAuth(null);
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
