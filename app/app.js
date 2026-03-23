// ===== app.js — Main entry point for ChetanSmartTrip PWA =====

const App = {
  currentDayNumber: 1,
  timerInterval: null,
  itinerary: null,

  async init() {
    try {
      // Auto-clear stale localStorage if data format changed
      Storage.checkDataVersion();

      // Load itinerary
      const response = await fetch('../data/itinerary.json').catch(() => fetch('./data/itinerary.json'));
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

    // Also update clock every second (with timezone abbreviation)
    setInterval(() => {
      document.getElementById('clock').textContent =
        ScheduleEngine.formatDateInTZ(ScheduleEngine.now(), this.currentDayNumber);
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

    // ===== Debug Time Override =====
    this._initDebugPanel();
  },

  _initDebugPanel() {
    const debugDate = document.getElementById('debug-date');
    const debugTime = document.getElementById('debug-time');
    const debugTz = document.getElementById('debug-tz');
    const debugStatus = document.getElementById('debug-status');

    // Pre-fill with trip start date and current time
    debugDate.value = '2026-03-24';
    debugTime.value = '08:00:00';

    // Restore saved override on load
    const saved = Storage.get('debug_time_override');
    if (saved) {
      ScheduleEngine.setTimeOverride(new Date(saved.epoch));
      debugDate.value = saved.date || debugDate.value;
      debugTime.value = saved.time || debugTime.value;
      debugTz.value = saved.tz || '';
      this._updateDebugStatus();
      this._onTimeOverrideChanged();
    }

    document.getElementById('btn-debug-apply').addEventListener('click', () => {
      const dateVal = debugDate.value;
      const timeVal = debugTime.value || '12:00:00';
      const tzVal = debugTz.value;

      if (!dateVal) {
        debugStatus.textContent = '⚠️ Please select a date';
        debugStatus.className = 'debug-status active';
        return;
      }

      // Build a Date in the selected timezone (or local if none)
      let fakeDate;
      if (tzVal) {
        // Create date as if we're in that timezone
        // Parse the local datetime, find the offset, and construct correct epoch
        const localStr = `${dateVal}T${timeVal}`;
        const naive = new Date(localStr);  // Parsed as local

        // Get what the time would be in target TZ
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: tzVal,
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          hour12: false
        });
        // Current offset of target TZ from UTC
        const nowInTZ = formatter.formatToParts(new Date());
        const localNow = new Date();
        // Simpler: just use the date/time as-is and let the TZ conversion handle it
        // We want: "pretend it's dateVal timeVal in tzVal"
        // So we create a UTC time that, when converted to tzVal, shows our desired time
        const probe = new Date(`${dateVal}T${timeVal}Z`); // treat as UTC first
        const inTZ = new Intl.DateTimeFormat('en-US', {
          timeZone: tzVal, hour: 'numeric', minute: 'numeric', hour12: false
        }).formatToParts(probe);
        const tzHour = parseInt(inTZ.find(p => p.type === 'hour')?.value || '0');
        const tzMin = parseInt(inTZ.find(p => p.type === 'minute')?.value || '0');
        const [wantH, wantM, wantS] = timeVal.split(':').map(Number);
        const offsetMins = ((tzHour * 60 + tzMin) - (wantH * 60 + wantM));
        fakeDate = new Date(probe.getTime() - offsetMins * 60000);
      } else {
        // No TZ selected — treat as device-local time
        fakeDate = new Date(`${dateVal}T${timeVal}`);
      }

      ScheduleEngine.setTimeOverride(fakeDate);

      // Save to localStorage so it persists across refreshes
      Storage.set('debug_time_override', {
        epoch: fakeDate.getTime(),
        date: dateVal,
        time: timeVal,
        tz: tzVal
      });

      this._updateDebugStatus();
      this._onTimeOverrideChanged();
    });

    document.getElementById('btn-debug-clear').addEventListener('click', () => {
      ScheduleEngine.clearTimeOverride();
      Storage.remove('debug_time_override');
      this._updateDebugStatus();
      this._onTimeOverrideChanged();
    });
  },

  _updateDebugStatus() {
    const el = document.getElementById('debug-status');
    if (ScheduleEngine.hasTimeOverride()) {
      const fakeNow = ScheduleEngine.now();
      const dayNum = this.currentDayNumber;
      el.textContent = '⏱ Override active: ' +
        ScheduleEngine.formatFullTimestampInTZ(fakeNow, dayNum);
      el.className = 'debug-status active';
    } else {
      el.textContent = '✓ Using real time';
      el.className = 'debug-status off';
    }
  },

  _onTimeOverrideChanged() {
    // Auto-switch to the correct day for the overridden date
    const todayNum = ScheduleEngine.currentDayNumber();
    if (todayNum) {
      this.renderDay(todayNum);
    } else {
      // Date is outside trip range — stay on current day but refresh
      this._updateCurrentStatus();
    }
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

    const epochMs = ScheduleEngine.nowEpoch();
    Storage.recordArrival(activityId, epochMs);

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

    const epochMs = ScheduleEngine.nowEpoch();
    Storage.recordDeparture(activityId, epochMs);

    // Adjust schedule using epoch-based comparison (only meaningful for today)
    if (ScheduleEngine.isDayToday(dayNumber)) {
      const delta = ScheduleEngine.adjustSchedule(dayNumber, activityId);

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
