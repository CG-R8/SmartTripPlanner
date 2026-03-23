// ===== schedule-engine.js — Core time comparison & schedule logic =====

const ScheduleEngine = {

  itinerary: null,

  load(data) {
    this.itinerary = data;
  },

  // ===== Date / Time Helpers =====

  getTripDay(dateStr) {
    return this.itinerary.days.find(d => d.date === dateStr) || null;
  },

  getTripDayByNumber(dayNum) {
    return this.itinerary.days.find(d => d.dayNumber === dayNum) || null;
  },

  /** Get today's date as YYYY-MM-DD */
  todayStr() {
    const now = new Date();
    return now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0');
  },

  /** Get current trip day number (1-8), or null if outside trip dates */
  currentDayNumber() {
    const today = this.todayStr();
    const day = this.itinerary.days.find(d => d.date === today);
    return day ? day.dayNumber : null;
  },

  /** Check if a given day number is actually today's calendar date */
  isDayToday(dayNumber) {
    const day = this.getTripDayByNumber(dayNumber);
    return day ? day.date === this.todayStr() : false;
  },

  /** Check if a given day number is in the past */
  isDayPast(dayNumber) {
    const day = this.getTripDayByNumber(dayNumber);
    if (!day) return false;
    return day.date < this.todayStr();
  },

  /** Check if a given day number is in the future */
  isDayFuture(dayNumber) {
    const day = this.getTripDayByNumber(dayNumber);
    if (!day) return false;
    return day.date > this.todayStr();
  },

  /** Parse "HH:MM" time string into minutes since midnight */
  parseTime(timeStr) {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  },

  /** Format minutes since midnight back to "h:mm AM/PM" */
  formatTime(totalMins) {
    if (totalMins == null) return '—';
    let hours = Math.floor(totalMins / 60) % 24;
    const mins = totalMins % 60;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    if (hours === 0) hours = 12;
    else if (hours > 12) hours -= 12;
    return `${hours}:${String(mins).padStart(2, '0')} ${ampm}`;
  },

  /** Current time as minutes since midnight */
  nowMinutes() {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  },

  /** Format a Date object as "h:mm AM/PM" */
  formatDate(date) {
    let h = date.getHours();
    const m = date.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
  },

  // ===== Activity Lookup =====

  /** Get all activities for a given day number */
  getDayActivities(dayNumber) {
    const day = this.getTripDayByNumber(dayNumber);
    return day ? day.activities : [];
  },

  /** Get adjusted start/end times for an activity, factoring in schedule shift */
  getAdjustedTimes(activity, dayNumber) {
    const delta = Storage.getDayAdjustment(dayNumber);
    const start = this.parseTime(activity.plannedStart);
    const end = this.parseTime(activity.plannedEnd);
    return {
      start: start != null ? start + delta : null,
      end: end != null ? end + delta : null,
      delta
    };
  },

  /** Find which activity should be "current" based on time and check-ins */
  findCurrentActivity(dayNumber) {
    const activities = this.getDayActivities(dayNumber);
    const checkins = Storage.getCheckIns();
    const isToday = this.isDayToday(dayNumber);

    // First: find any activity we've arrived at but not left (works for any day)
    for (const act of activities) {
      const ci = checkins[act.id];
      if (ci && ci.arrivedAt && !ci.leftAt) {
        return act;
      }
    }

    // Only use real-time matching if this day IS today
    if (isToday) {
      const now = this.nowMinutes();

      // Second: find activity whose adjusted time window contains "now"
      // SKIP activities that are already done (both arrived + left)
      for (const act of activities) {
        const ci = checkins[act.id];
        if (ci && ci.arrivedAt && ci.leftAt) continue; // done, skip
        const times = this.getAdjustedTimes(act, dayNumber);
        if (times.start != null && times.end != null) {
          if (now >= times.start && now <= times.end) {
            return act;
          }
        }
      }

      // Third: find the last NOT-done activity whose start time has passed
      let latest = null;
      for (const act of activities) {
        const ci = checkins[act.id];
        if (ci && ci.arrivedAt && ci.leftAt) continue; // done, skip
        const times = this.getAdjustedTimes(act, dayNumber);
        if (times.start != null && now >= times.start) {
          latest = act;
        }
      }

      // If all time-passed activities are done, pick the next upcoming one
      if (!latest) {
        for (const act of activities) {
          const ci = checkins[act.id];
          if (ci && ci.arrivedAt && ci.leftAt) continue; // done, skip
          latest = act;
          break; // first non-done activity
        }
      }

      return latest || (activities.length > 0 ? activities[0] : null);
    }

    // For past/future days: return first non-done activity, or first overall
    for (const act of activities) {
      const ci = checkins[act.id];
      if (!ci || !ci.arrivedAt || !ci.leftAt) return act;
    }
    return activities.length > 0 ? activities[0] : null;
  },

  /** Find the next activity after the current one */
  findNextActivity(dayNumber, currentId) {
    const activities = this.getDayActivities(dayNumber);
    const idx = activities.findIndex(a => a.id === currentId);
    if (idx >= 0 && idx < activities.length - 1) {
      return activities[idx + 1];
    }
    return null;
  },

  /** Get activity index in the day */
  getActivityIndex(dayNumber, activityId) {
    const activities = this.getDayActivities(dayNumber);
    return activities.findIndex(a => a.id === activityId);
  },

  // ===== Status Calculation =====

  /** Calculate schedule status for current activity */
  calculateStatus(dayNumber) {
    const current = this.findCurrentActivity(dayNumber);
    if (!current) return { status: 'no-data', delta: 0, message: 'No activities found' };

    const isToday = this.isDayToday(dayNumber);
    const day = this.getTripDayByNumber(dayNumber);

    // For future days: show preview mode
    if (this.isDayFuture(dayNumber)) {
      return {
        status: 'waiting',
        delta: 0,
        message: `📅 Preview — ${day.dayOfWeek}, ${day.date}`,
        current
      };
    }

    // For past days: show completed mode (unless there's active check-in data)
    if (this.isDayPast(dayNumber)) {
      const checkin = Storage.getCheckin(current.id);
      if (checkin && checkin.arrivedAt && !checkin.leftAt) {
        return { status: 'on-track', delta: 0, message: `At ${current.title} (past day)`, current };
      }
      return {
        status: 'on-track',
        delta: 0,
        message: `✅ Day ${dayNumber} completed — ${day.date}`,
        current
      };
    }

    // === Today: use real-time comparison ===
    const now = this.nowMinutes();
    const times = this.getAdjustedTimes(current, dayNumber);
    const checkin = Storage.getCheckin(current.id);
    const settings = Storage.getSettings();

    // If we haven't arrived yet
    if (!checkin || !checkin.arrivedAt) {
      if (times.start == null) return { status: 'waiting', delta: 0, message: 'Waiting...' };

      const diff = now - times.start;
      if (diff < 0) {
        return {
          status: 'early',
          delta: Math.abs(diff),
          message: `${Math.abs(diff)} min until ${current.title}`,
          current
        };
      } else if (diff <= settings.lateThresholdMinutes) {
        return {
          status: 'on-track',
          delta: diff,
          message: `On track — ${current.title}`,
          current
        };
      } else {
        return {
          status: diff > 30 ? 'very-late' : 'late',
          delta: diff,
          message: `${diff} min behind — should be at ${current.title}`,
          current
        };
      }
    }

    // If we're checked in (arrived but not left)
    if (checkin.arrivedAt && !checkin.leftAt) {
      if (times.end == null) return { status: 'on-track', delta: 0, message: `At ${current.title}`, current };

      const timeLeft = times.end - now;
      if (timeLeft > 15) {
        return {
          status: 'on-track',
          delta: 0,
          message: `At ${current.title} — ${timeLeft} min remaining`,
          current
        };
      } else if (timeLeft > 0) {
        return {
          status: 'late',
          delta: 0,
          message: `Wrap up soon! ${timeLeft} min left at ${current.title}`,
          current
        };
      } else {
        return {
          status: 'late',
          delta: Math.abs(timeLeft),
          message: `${Math.abs(timeLeft)} min over planned time at ${current.title}`,
          current
        };
      }
    }

    return { status: 'on-track', delta: 0, message: 'Moving along!', current };
  },

  // ===== Schedule Adjustment =====

  /**
   * When user checks out of an activity, recalculate schedule shift.
   * Returns the new delta in minutes (positive = late, negative = early).
   */
  adjustSchedule(dayNumber, activityId, departureTime) {
    const activities = this.getDayActivities(dayNumber);
    const idx = activities.findIndex(a => a.id === activityId);
    if (idx < 0) return 0;

    const activity = activities[idx];
    const plannedEnd = this.parseTime(activity.plannedEnd);
    if (plannedEnd == null) return 0;

    const actualEnd = typeof departureTime === 'number' ? departureTime : this.nowMinutes();
    const newDelta = actualEnd - plannedEnd;

    Storage.setDayAdjustment(dayNumber, newDelta);
    return newDelta;
  },

  // ===== Activity Type Helpers =====

  getTypeIcon(type) {
    const icons = {
      travel: '🚗',
      meal: '🍽️',
      visit: '📍',
      checkin: '🏨',
      checkout: '📦',
      rest: '😴',
      errand: '🛒',
      free: '🌴'
    };
    return icons[type] || '📌';
  },

  getTypeLabel(type) {
    const labels = {
      travel: 'Drive',
      meal: 'Food',
      visit: 'Visit',
      checkin: 'Check-in',
      checkout: 'Checkout',
      rest: 'Rest',
      errand: 'Errand',
      free: 'Free Time'
    };
    return labels[type] || type;
  }
};
