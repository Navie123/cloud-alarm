// Cloud Fire Alarm - API Module
const api = {
  get baseUrl() {
    return CONFIG.API_URL;
  },
  
  get token() {
    return localStorage.getItem('householdToken');
  },

  setToken(token) {
    if (token) localStorage.setItem('householdToken', token);
    else localStorage.removeItem('householdToken');
  },

  async request(endpoint, options = {}) {
    const url = `${CONFIG.API_URL}${endpoint}`;
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const response = await fetch(url, { ...options, headers });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  // Household
  async joinHousehold(householdId, accessCode, memberName) {
    const data = await this.request('/api/household/join', {
      method: 'POST',
      body: JSON.stringify({ householdId, accessCode, memberName })
    });
    if (data.token) this.setToken(data.token);
    return data;
  },

  async getHouseholdInfo() {
    return this.request('/api/household/info');
  },

  logout() {
    this.request('/api/household/logout', { method: 'POST' }).catch(() => {});
    this.setToken(null);
    localStorage.removeItem('memberId');
  },

  // Device
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
    return this.request(`/api/device/${deviceId}/silence`, { method: 'POST' });
  },

  async getHistory(deviceId) {
    return this.request(`/api/device/${deviceId}/history`);
  },

  async clearHistory(deviceId) {
    return this.request(`/api/device/${deviceId}/history`, { method: 'DELETE' });
  },

  // Push
  async getVapidKey() {
    return this.request('/api/push/vapid-key');
  },

  async subscribePush(subscription, deviceId) {
    return this.request('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ subscription, deviceId })
    });
  },

  async unsubscribePush(endpoint, deviceId) {
    return this.request('/api/push/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint, deviceId })
    });
  }
};
