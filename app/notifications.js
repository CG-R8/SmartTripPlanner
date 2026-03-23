// ===== notifications.js — Browser Notifications + Speech Synthesis =====

const Notify = {

  /** Request permission for browser notifications */
  async requestPermission() {
    if (!('Notification' in window)) {
      console.warn('Notifications not supported');
      return false;
    }
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  },

  /** Send a browser notification */
  send(title, body, tag) {
    const settings = Storage.getSettings();
    if (!settings.notificationsEnabled) return;

    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '🗺️',
          tag: tag || 'smarttrip',
          requireInteraction: false,
          silent: false
        });
      } catch (e) {
        // Fallback: some mobile browsers don't support Notification constructor
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'notification',
            title,
            body,
            tag
          });
        }
      }
    }
  },

  /** Speak a message using Web Speech API */
  speak(message) {
    const settings = Storage.getSettings();
    if (!settings.voiceEnabled) return;

    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported');
      return;
    }

    // Cancel any pending speech
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Try to use a natural-sounding voice
    const voices = speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel')
    );
    if (preferred) utterance.voice = preferred;

    speechSynthesis.speak(utterance);
  },

  /** Combined notification: browser + optional voice */
  alert(title, body, options = {}) {
    this.send(title, body, options.tag);
    if (options.voice !== false) {
      this.speak(body);
    }
  },

  // ===== Smart Notifications Based on Schedule Status =====

  _lastNotifiedStatus: null,
  _lastNotifiedTime: 0,
  _NOTIFY_COOLDOWN: 5 * 60 * 1000, // 5 minutes between notifications

  /** Process schedule status and send appropriate notifications */
  processStatus(status) {
    const now = Date.now();

    // Don't spam notifications
    if (now - this._lastNotifiedTime < this._NOTIFY_COOLDOWN) return;

    // Don't re-notify for same status
    const statusKey = status.status + '_' + (status.current?.id || '');
    if (statusKey === this._lastNotifiedStatus) return;

    switch (status.status) {
      case 'late':
        this.alert(
          '⏰ Running Late',
          status.message,
          { tag: 'schedule-late' }
        );
        this._lastNotifiedStatus = statusKey;
        this._lastNotifiedTime = now;
        break;

      case 'very-late':
        this.alert(
          '🚨 Significantly Behind Schedule',
          status.message,
          { tag: 'schedule-very-late' }
        );
        this._lastNotifiedStatus = statusKey;
        this._lastNotifiedTime = now;
        break;

      // Don't notify for on-track / early (not annoying)
      default:
        break;
    }
  },

  /** Notify about next activity when leaving current */
  notifyNextUp(nextActivity, dayNumber) {
    if (!nextActivity) return;

    const times = ScheduleEngine.getAdjustedTimes(nextActivity, dayNumber);
    const tz = ScheduleEngine.getActivityTimezone(nextActivity, dayNumber);
    const timeStr = times.startEpoch != null ? ScheduleEngine.formatEpochAsTime(times.startEpoch, tz) : '';
    const dist = nextActivity.distance;
    let body = `Next: ${nextActivity.title}`;
    if (timeStr) body += ` at ${timeStr}`;
    if (dist) body += ` — ${dist.miles} mi, ~${dist.estimatedMinutes} min`;

    this.alert('🗺️ Next Up', body, { tag: 'next-up' });
  },

  /** Morning briefing notification */
  morningBriefing(day) {
    const highlights = (day.highlights || []).join(', ');
    const weather = day.weather?.summary || '';
    this.alert(
      `🌅 Day ${day.dayNumber}: ${day.title}`,
      `${weather}. Highlights: ${highlights}`,
      { tag: 'morning-briefing' }
    );
  },

  /** Confirmation number notification */
  showConfirmation(text) {
    this.alert(
      '📋 Confirmation Number',
      text,
      { tag: 'confirmation', voice: true }
    );
  }
};

// Load voices (async in some browsers)
if ('speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
}
