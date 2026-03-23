// ===== app.js — Main entry point for ChetanSmartTrip PWA =====

const App = {
  currentDayNumber: 1,
  timerInterval: null,
  itinerary: null,

  async init() {
    try {
      // Load itinerary
      const response = await fetch('../data/itinerary.json');
      this.itinerary = await response.json();
      ScheduleEngine.load(this.itinerary);

      // Determine current day
      const tripDay = ScheduleEngine.currentDayNumber();
      this.currentDayNumber = tripDay || 1;

      // Render static views
      UI.renderOverview(this.itinerary, this.currentDayNumber);
      UI.renderEmergency(this.itinerary);

      // Load settings into UI
      this._loadSettings();

      // Bind events
      this._bindEvents();

      // Request notification permission
      Notify.requestPermission();

      // Initial render
      this.renderDay(this.currentDayNumber);

      // Check for morning briefing
      this._checkMorningBriefing();

      // Start the timer loop
      this._startTimer();

      // Register service worker
      this._registerSW();

      console.log('SmartTrip loaded! Day', this.currentDayNumber);
    } catch (err) {
      console.error('Failed to initialize:', err);
      document.getElementById('status-text').textContent = 'Error loading trip data';
    }
  },

  // ===== Render Current Day =====

  renderDay(dayNumber) {
    const day = ScheduleEngine.getTripDayByNumber(dayNumber);
    if (!day) return;

    this.currentDayNumber = dayNumber;

    // Header
    UI.renderDayHeader(day);
    UI.renderWeather(day);
    UI.renderHotel(day);
    UI.renderTimeline(dayNumber);
    UI.renderExpenses(dayNumber);

    // Current + Next
    this._updateCurrentStatus();

    // Nav buttons
    document.getElementById('prev-day').disabled = dayNumber <= 1;
    document.getElementById('next-day').disabled = dayNumber >= this.itinerary.days.length;
  },

  switchToDay(dayNumber) {
    if (dayNumber < 1 || dayNumber > this.itinerary.days.length) return;
    this.renderDay(dayNumber);

    // Switch to today view
    this._switchView('today');
  },

  // ===== Timer Loop =====

  _startTimer() {
    const settings = Storage.getSettings();
    const interval = (settings.checkIntervalSeconds || 60) * 1000;

    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      this._updateCurrentStatus();
    }, interval);

    // Also update clock every second
    setInterval(() => {
      document.getElementById('clock').textContent =
        ScheduleEngine.formatDate(new Date());
    }, 1000);
  },

  _updateCurrentStatus() {
    const dayNum = this.currentDayNumber;

    // Calculate status
    const status = ScheduleEngine.calculateStatus(dayNum);
    const current = ScheduleEngine.findCurrentActivity(dayNum);
    const next = current ?
      ScheduleEngine.findNextActivity(dayNum, current.id) : null;

    // Render
    UI.renderCurrentActivity(current, dayNum, status);
    UI.renderNextActivity(next, dayNum);
    UI.renderStatusBar(status);
    UI.renderTimeline(dayNum);

    // Process notifications
    Notify.processStatus(status);
  },

  // ===== Event Handlers =====

  _bindEvents() {
    // Day navigation
    document.getElementById('prev-day').addEventListener('click', () => {
      this.switchToDay(this.currentDayNumber - 1);
    });
    document.getElementById('next-day').addEventListener('click', () => {
      this.switchToDay(this.currentDayNumber + 1);
    });

    // Swipe navigation
    let touchStartX = 0;
    document.getElementById('app').addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    document.getElementById('app').addEventListener('touchend', (e) => {
      const delta = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(delta) > 80) {
        if (delta > 0) this.switchToDay(this.currentDayNumber - 1);
        else this.switchToDay(this.currentDayNumber + 1);
      }
    }, { passive: true });

    // Arrive / Leave buttons (on the main current-activity card)
    document.getElementById('btn-arrived').addEventListener('click', () => {
      this._handleArrival();
    });
    document.getElementById('btn-leaving').addEventListener('click', () => {
      this._handleDeparture();
    });

    // Reset data button
    document.getElementById('btn-reset-data').addEventListener('click', async () => {
      if (confirm('⚠️ Reset ALL trip data?\n\nThis clears all check-ins, expenses, schedule adjustments, and settings. This cannot be undone.')) {
        console.log('[Reset] Starting full reset...');
        // 1. Clear localStorage
        Storage.clearAllData();
        // 2. Unregister service workers
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const reg of registrations) {
            await reg.unregister();
            console.log('[Reset] Unregistered SW:', reg.scope);
          }
        }
        // 3. Clear all caches
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          for (const name of cacheNames) {
            await caches.delete(name);
            console.log('[Reset] Deleted cache:', name);
          }
        }
        console.log('[Reset] Complete. Reloading...');
        // 4. Hard reload bypassing cache
        location.reload(true);
      }
    });

    // Hotel confirmation
    document.getElementById('btn-show-confirmation').addEventListener('click', () => {
      const day = ScheduleEngine.getTripDayByNumber(this.currentDayNumber);
      if (day) UI.showConfirmation(day);
    });
    document.getElementById('confirmation-dismiss').addEventListener('click', () => {
      UI.hideConfirmation();
    });

    // Morning briefing
    document.getElementById('briefing-dismiss').addEventListener('click', () => {
      const todayStr = ScheduleEngine.todayStr();
      Storage.markBriefingShown(todayStr);
      UI.hideMorningBriefing();
    });
    document.getElementById('btn-show-briefing').addEventListener('click', () => {
      const day = ScheduleEngine.getTripDayByNumber(this.currentDayNumber);
      if (day) UI.showMorningBriefing(day);
    });

    // Expenses
    document.getElementById('btn-add-expense').addEventListener('click', () => {
      this._addExpense();
    });
    document.getElementById('expense-amount').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._addExpense();
    });

    // Bottom navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this._switchView(tab.dataset.view);
      });
    });

    // Settings
    document.getElementById('setting-voice').addEventListener('change', (e) => {
      Storage.saveSetting('voiceEnabled', e.target.checked);
    });
    document.getElementById('setting-notifications').addEventListener('change', (e) => {
      Storage.saveSetting('notificationsEnabled', e.target.checked);
      if (e.target.checked) Notify.requestPermission();
    });
    document.getElementById('setting-interval').addEventListener('change', (e) => {
      Storage.saveSetting('checkIntervalSeconds', parseInt(e.target.value));
      this._startTimer(); // Restart with new interval
    });
    document.getElementById('setting-late-threshold').addEventListener('change', (e) => {
      Storage.saveSetting('lateThresholdMinutes', parseInt(e.target.value));
    });

    // Export
    document.getElementById('btn-export-log').addEventListener('click', () => {
      Storage.exportTripLog();
    });
  },

  // ===== Arrival / Departure — works for ANY activity =====

  /** Called from the main "current activity" card buttons */
  _handleArrival() {
    const current = ScheduleEngine.findCurrentActivity(this.currentDayNumber);
    if (!current) return;
    this.handleArrivalFor(current.id, this.currentDayNumber);
  },

  _handleDeparture() {
    const current = ScheduleEngine.findCurrentActivity(this.currentDayNumber);
    if (!current) return;
    this.handleDepartureFor(current.id, this.currentDayNumber);
  },

  /** Public: mark arrival for any activity (called from timeline buttons too) */
  handleArrivalFor(activityId, dayNumber) {
    const activity = ScheduleEngine.getDayActivities(dayNumber).find(a => a.id === activityId);
    if (!activity) return;

    const nowMins = ScheduleEngine.nowMinutes();
    Storage.recordArrival(activityId, nowMins);

    // Show confirmation if available
    if (activity.confirmation) {
      Notify.showConfirmation(`${activity.title}: #${activity.confirmation}`);
    }

    // Show what-to-do info
    if (activity.whatToDo && activity.whatToDo.length) {
      const msg = 'Welcome! Things to do:\n' + activity.whatToDo.slice(0, 3).join(', ');
      Notify.alert('📍 Arrived!', msg, { tag: 'arrival' });
    }

    this._updateCurrentStatus();
  },

  /** Public: mark departure for any activity (called from timeline buttons too) */
  handleDepartureFor(activityId, dayNumber) {
    const activity = ScheduleEngine.getDayActivities(dayNumber).find(a => a.id === activityId);
    if (!activity) return;

    const nowMins = ScheduleEngine.nowMinutes();
    Storage.recordDeparture(activityId, nowMins);

    // Adjust schedule
    const delta = ScheduleEngine.adjustSchedule(dayNumber, activityId, nowMins);

    // Notify about adjustment
    if (delta > 5) {
      Notify.alert('⏰ Schedule Adjusted',
        `Running ${delta} min late. Remaining activities shifted.`,
        { tag: 'schedule-adjust' });
    } else if (delta < -5) {
      Notify.alert('⏩ Ahead of Schedule!',
        `${Math.abs(delta)} min early! Remaining activities shifted.`,
        { tag: 'schedule-adjust' });
    }

    // Notify about next activity
    const next = ScheduleEngine.findNextActivity(dayNumber, activityId);
    if (next) {
      Notify.notifyNextUp(next, dayNumber);
    }

    this._updateCurrentStatus();
  },

  _addExpense() {
    const descInput = document.getElementById('expense-desc');
    const amtInput = document.getElementById('expense-amount');

    const desc = descInput.value.trim();
    const amt = parseFloat(amtInput.value);

    if (!desc || isNaN(amt) || amt <= 0) return;

    Storage.addExpense(this.currentDayNumber, desc, amt);

    descInput.value = '';
    amtInput.value = '';

    UI.renderExpenses(this.currentDayNumber);

    // Update total in settings
    document.getElementById('trip-total-expenses').textContent =
      '$' + Storage.getTotalExpenses().toFixed(2);
  },

  // ===== View Switching =====

  _switchView(view) {
    // Update nav tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.view === view);
    });

    // Toggle views
    const app = document.getElementById('app');
    const overview = document.getElementById('view-overview');
    const emergency = document.getElementById('view-emergency');
    const settings = document.getElementById('view-settings');

    app.classList.toggle('hidden', view !== 'today');
    overview.classList.toggle('hidden', view !== 'overview');
    emergency.classList.toggle('hidden', view !== 'emergency');
    settings.classList.toggle('hidden', view !== 'settings');

    // Update settings total when shown
    if (view === 'settings') {
      document.getElementById('trip-total-expenses').textContent =
        '$' + Storage.getTotalExpenses().toFixed(2);
    }
  },

  // ===== Morning Briefing =====

  _checkMorningBriefing() {
    const todayStr = ScheduleEngine.todayStr();
    const day = ScheduleEngine.getTripDay(todayStr);

    if (day && !Storage.hasBriefingBeenShown(todayStr)) {
      UI.showMorningBriefing(day);
      Notify.morningBriefing(day);
    }
  },

  // ===== Settings =====

  _loadSettings() {
    const settings = Storage.getSettings();
    document.getElementById('setting-voice').checked = settings.voiceEnabled;
    document.getElementById('setting-notifications').checked = settings.notificationsEnabled;
    document.getElementById('setting-interval').value = settings.checkIntervalSeconds;
    document.getElementById('setting-late-threshold').value = settings.lateThresholdMinutes;
  },

  // ===== Service Worker =====

  async _registerSW() {
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('sw.js');
        console.log('Service Worker registered:', reg.scope);
      } catch (err) {
        console.warn('Service Worker registration failed:', err);
      }
    }
  }
};

// ===== Boot =====
document.addEventListener('DOMContentLoaded', () => App.init());
