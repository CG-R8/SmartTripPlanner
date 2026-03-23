// ===== storage.js — LocalStorage wrapper for ChetanSmartTrip =====

const Storage = {
  PREFIX: 'smarttrip_',

  get(key) {
    try {
      const raw = localStorage.getItem(this.PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage write failed:', e);
    }
  },

  remove(key) {
    localStorage.removeItem(this.PREFIX + key);
  },

  // ===== Check-in / Check-out Records =====

  getCheckIns() {
    return this.get('checkins') || {};
  },

  recordArrival(activityId, time) {
    const checkins = this.getCheckIns();
    if (!checkins[activityId]) checkins[activityId] = {};
    checkins[activityId].arrivedAt = time;
    this.set('checkins', checkins);
  },

  recordDeparture(activityId, time) {
    const checkins = this.getCheckIns();
    if (!checkins[activityId]) checkins[activityId] = {};
    checkins[activityId].leftAt = time;
    this.set('checkins', checkins);
  },

  getCheckin(activityId) {
    const checkins = this.getCheckIns();
    return checkins[activityId] || null;
  },

  // ===== Schedule Adjustments =====

  getAdjustments() {
    return this.get('adjustments') || {};
  },

  setDayAdjustment(dayNumber, deltaMinutes) {
    const adj = this.getAdjustments();
    adj[dayNumber] = deltaMinutes;
    this.set('adjustments', adj);
  },

  getDayAdjustment(dayNumber) {
    const adj = this.getAdjustments();
    return adj[dayNumber] || 0;
  },

  // ===== Expenses =====

  getExpenses() {
    return this.get('expenses') || [];
  },

  addExpense(dayNumber, description, amount) {
    const expenses = this.getExpenses();
    expenses.push({
      id: Date.now(),
      dayNumber,
      description,
      amount: parseFloat(amount),
      timestamp: new Date().toISOString()
    });
    this.set('expenses', expenses);
    return expenses;
  },

  getDayExpenses(dayNumber) {
    return this.getExpenses().filter(e => e.dayNumber === dayNumber);
  },

  getTotalExpenses() {
    return this.getExpenses().reduce((sum, e) => sum + e.amount, 0);
  },

  // ===== Settings =====

  getSettings() {
    return this.get('settings') || {
      voiceEnabled: false,
      notificationsEnabled: true,
      checkIntervalSeconds: 60,
      lateThresholdMinutes: 10
    };
  },

  saveSetting(key, value) {
    const settings = this.getSettings();
    settings[key] = value;
    this.set('settings', settings);
  },

  // ===== Morning Briefing =====

  hasBriefingBeenShown(date) {
    return this.get('briefing_shown_' + date) === true;
  },

  markBriefingShown(date) {
    this.set('briefing_shown_' + date, true);
  },

  // ===== Reset =====

  clearAllData() {
    const prefix = 'smarttrip_';
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) keys.push(key);
    }
    console.log('[Reset] Clearing', keys.length, 'keys:', keys);
    keys.forEach(k => localStorage.removeItem(k));
    // Verify
    const remaining = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) remaining.push(key);
    }
    if (remaining.length > 0) {
      console.warn('[Reset] Still remaining:', remaining);
      remaining.forEach(k => localStorage.removeItem(k));
    }
    console.log('[Reset] Done. localStorage entries left:', localStorage.length);
  },

  // ===== Export =====

  exportTripLog() {
    const data = {
      checkins: this.getCheckIns(),
      expenses: this.getExpenses(),
      adjustments: this.getAdjustments(),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'smarttrip-log-' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }
};
