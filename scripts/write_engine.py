#!/usr/bin/env python3
"""Write the new UTC-based schedule-engine.js"""
import os

CONTENT = r"""// ===== schedule-engine.js — Core time comparison & schedule logic =====
// All times in itinerary.json are stored as UTC ISO-8601 strings (startTimeUTC, endTimeUTC).
// Each activity has its own IANA timezone for display.
// Comparisons are done in epoch milliseconds (absolute time — no TZ math needed).

const ScheduleEngine = {

  itinerary: null,
  _timeOverride: null,

  load(data) { this.itinerary = data; },

  // ===== Time Override for Testing =====

  setTimeOverride(date) {
    this._timeOverride = date instanceof Date ? date : new Date(date);
    console.log('[TimeOverride] SET →', this._timeOverride.toISOString());
  },
  clearTimeOverride() {
    this._timeOverride = null;
    console.log('[TimeOverride] CLEARED — using real time');
  },
  hasTimeOverride() { return this._timeOverride !== null; },

  /** Get current Date (override-aware) */
  now() {
    return this._timeOverride ? new Date(this._timeOverride.getTime()) : new Date();
  },
  /** Get current epoch ms (override-aware) */
  nowEpoch() {
    return this._timeOverride ? this._timeOverride.getTime() : Date.now();
  },

  // ===== Trip Day Lookup =====

  getTripDay(dateStr) {
    return this.itinerary.days.find(d => d.date === dateStr) || null;
  },
  getTripDayByNumber(dayNum) {
    return this.itinerary.days.find(d => d.dayNumber === dayNum) || null;
  },

  // ===== Date Helpers =====

  todayStr() {
    const now = this.now();
    return now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0');
  },

  currentDayNumber() {
    const today = this.todayStr();
    const day = this.itinerary.days.find(d => d.date === today);
    return day ? day.dayNumber : null;
  },

  isDayToday(dayNumber) {
    const day = this.getTripDayByNumber(dayNumber);
    return day ? day.date === this.todayStr() : false;
  },
  isDayPast(dayNumber) {
    const day = this.getTripDayByNumber(dayNumber);
    return day ? day.date < this.todayStr() : false;
  },
  isDayFuture(dayNumber) {
    const day = this.getTripDayByNumber(dayNumber);
    return day ? day.date > this.todayStr() : false;
  },

  // ===== Activity Timezone =====

  /** Get the IANA timezone for a specific activity (per-activity field, or day fallback) */
  getActivityTimezone(activity, dayNumber) {
    if (activity.timezone && activity.timezone.startsWith('America/')) {
      return activity.timezone;
    }
    return this.getDayTimezone(dayNumber);
  },

  /** Get the day-level default IANA timezone */
  getDayTimezone(dayNumber) {
    const day = this.getTripDayByNumber(dayNumber);
    return (day && day.timezone) ? day.timezone : Intl.DateTimeFormat().resolvedOptions().timeZone;
  },

  // ===== Activity Epoch Accessors =====

  getStartEpoch(activity) {
    return activity.startTimeUTC ? new Date(activity.startTimeUTC).getTime() : null;
  },
  getEndEpoch(activity) {
    return activity.endTimeUTC ? new Date(activity.endTimeUTC).getTime() : null;
  },

  // ===== Time Formatting =====

  /** Get TZ abbreviation (e.g. "PDT") for an IANA timezone string */
  getTimezoneAbbrForTZ(tz) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
        .formatToParts(this.now());
      const p = parts.find(x => x.type === 'timeZoneName');
      return p ? p.value : tz;
    } catch(e) { return tz; }
  },

  /** Get TZ abbreviation for a day number */
  getTimezoneAbbr(dayNumber) {
    return this.getTimezoneAbbrForTZ(this.getDayTimezone(dayNumber));
  },

  /** "6:59 PM" — short time in a given TZ */
  formatEpochAsTime(epochMs, tz) {
    if (epochMs == null) return '\u2014';
    try {
      return new Date(epochMs).toLocaleTimeString('en-US', {
        timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true
      });
    } catch(e) {
      const d = new Date(epochMs);
      let h = d.getHours(); const m = d.getMinutes();
      const ap = h >= 12 ? 'PM' : 'AM';
      if (h === 0) h = 12; else if (h > 12) h -= 12;
      return h + ':' + String(m).padStart(2, '0') + ' ' + ap;
    }
  },

  /** "6:59:04 PM PDT" — time with seconds + TZ label */
  formatEpochAsTimeFull(epochMs, tz) {
    if (epochMs == null) return '\u2014';
    try {
      return new Date(epochMs).toLocaleTimeString('en-US', {
        timeZone: tz, hour: 'numeric', minute: '2-digit', second: '2-digit',
        hour12: true, timeZoneName: 'short'
      });
    } catch(e) { return new Date(epochMs).toLocaleTimeString(); }
  },

  /** "Mar 24, 6:59:04 PM EDT" — full date+time+TZ */
  formatEpochAsFullTimestamp(epochMs, tz) {
    if (epochMs == null) return '\u2014';
    try {
      return new Date(epochMs).toLocaleString('en-US', {
        timeZone: tz, month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', second: '2-digit',
        hour12: true, timeZoneName: 'short'
      });
    } catch(e) { return new Date(epochMs).toLocaleString(); }
  },

  /** Clock display: "h:mm:ss AM/PM TZ" in the day's default timezone */
  formatDateInTZ(date, dayNumber) {
    return this.formatEpochAsTimeFull(date.getTime(), this.getDayTimezone(dayNumber));
  },

  /** Full timestamp using day timezone (for checkin display) */
  formatFullTimestampInTZ(date, dayNumber) {
    return this.formatEpochAsFullTimestamp(date.getTime(), this.getDayTimezone(dayNumber));
  },

  // ===== Activity Display Helpers =====

  /** Format activity start time for display in its timezone → "6:59 PM" */
  formatActivityStart(activity, dayNumber) {
    const epoch = this.getStartEpoch(activity);
    return this.formatEpochAsTime(epoch, this.getActivityTimezone(activity, dayNumber));
  },

  /** Format activity end time for display in its timezone → "10:14 PM" */
  formatActivityEnd(activity, dayNumber) {
    const epoch = this.getEndEpoch(activity);
    return this.formatEpochAsTime(epoch, this.getActivityTimezone(activity, dayNumber));
  },

  /** Get TZ abbreviation for a specific activity */
  getActivityTzAbbr(activity, dayNumber) {
    return this.getTimezoneAbbrForTZ(this.getActivityTimezone(activity, dayNumber));
  },

  // ===== Schedule Adjustment (epoch-based) =====

  /**
   * Get adjusted start/end epoch for an activity.
   * Delta (minutes) from Storage only applied for today.
   */
  getAdjustedTimes(activity, dayNumber) {
    const rawDelta = Storage.getDayAdjustment(dayNumber);
    const delta = this.isDayToday(dayNumber) ? rawDelta : 0;
    const deltaMs = delta * 60000;
    const startEpoch = this.getStartEpoch(activity);
    const endEpoch = this.getEndEpoch(activity);
    return {
      startEpoch: startEpoch != null ? startEpoch + deltaMs : null,
      endEpoch:   endEpoch   != null ? endEpoch   + deltaMs : null,
      delta
    };
  },

  // ===== Activity Lookup =====

  getDayActivities(dayNumber) {
    const day = this.getTripDayByNumber(dayNumber);
    return day ? day.activities : [];
  },

  findCurrentActivity(dayNumber) {
    const activities = this.getDayActivities(dayNumber);
    const checkins = Storage.getCheckIns();
    const isToday = this.isDayToday(dayNumber);

    // 1. Any activity we've arrived at but not left
    for (const act of activities) {
      const ci = checkins[act.id];
      if (ci && ci.arrivedAt && !ci.leftAt) return act;
    }

    // 2. Real-time matching (only for today)
    if (isToday) {
      const nowMs = this.nowEpoch();

      // Activity whose time window contains "now"
      for (const act of activities) {
        const ci = checkins[act.id];
        if (ci && ci.arrivedAt && ci.leftAt) continue;
        const t = this.getAdjustedTimes(act, dayNumber);
        if (t.startEpoch != null && t.endEpoch != null && nowMs >= t.startEpoch && nowMs <= t.endEpoch) {
          return act;
        }
      }

      // Last not-done activity whose start has passed
      let latest = null;
      for (const act of activities) {
        const ci = checkins[act.id];
        if (ci && ci.arrivedAt && ci.leftAt) continue;
        const t = this.getAdjustedTimes(act, dayNumber);
        if (t.startEpoch != null && nowMs >= t.startEpoch) latest = act;
      }

      // Or next upcoming not-done
      if (!latest) {
        for (const act of activities) {
          const ci = checkins[act.id];
          if (ci && ci.arrivedAt && ci.leftAt) continue;
          latest = act; break;
        }
      }

      return latest || activities[0] || null;
    }

    // Past/future: first non-done, or first
    for (const act of activities) {
      const ci = checkins[act.id];
      if (!ci || !ci.arrivedAt || !ci.leftAt) return act;
    }
    return activities[0] || null;
  },

  findNextActivity(dayNumber, currentId) {
    const activities = this.getDayActivities(dayNumber);
    const idx = activities.findIndex(a => a.id === currentId);
    return (idx >= 0 && idx < activities.length - 1) ? activities[idx + 1] : null;
  },

  getActivityIndex(dayNumber, activityId) {
    return this.getDayActivities(dayNumber).findIndex(a => a.id === activityId);
  },

  // ===== Status Calculation =====

  calculateStatus(dayNumber) {
    const current = this.findCurrentActivity(dayNumber);
    if (!current) return { status: 'no-data', delta: 0, message: 'No activities found' };

    const day = this.getTripDayByNumber(dayNumber);

    if (this.isDayFuture(dayNumber)) {
      return { status: 'waiting', delta: 0, message: `\ud83d\udcc5 Preview \u2014 ${day.dayOfWeek}, ${day.date}`, current };
    }
    if (this.isDayPast(dayNumber)) {
      const ci = Storage.getCheckin(current.id);
      if (ci && ci.arrivedAt && !ci.leftAt) {
        return { status: 'on-track', delta: 0, message: `At ${current.title} (past day)`, current };
      }
      return { status: 'on-track', delta: 0, message: `\u2705 Day ${dayNumber} completed \u2014 ${day.date}`, current };
    }

    // === Today ===
    const nowMs = this.nowEpoch();
    const times = this.getAdjustedTimes(current, dayNumber);
    const checkin = Storage.getCheckin(current.id);
    const settings = Storage.getSettings();

    if (!checkin || !checkin.arrivedAt) {
      if (times.startEpoch == null) return { status: 'waiting', delta: 0, message: 'Waiting...' };
      const diffMin = Math.round((nowMs - times.startEpoch) / 60000);
      if (diffMin < 0) {
        return { status: 'early', delta: Math.abs(diffMin), message: `${Math.abs(diffMin)} min until ${current.title}`, current };
      } else if (diffMin <= settings.lateThresholdMinutes) {
        return { status: 'on-track', delta: diffMin, message: `On track \u2014 ${current.title}`, current };
      } else {
        return { status: diffMin > 30 ? 'very-late' : 'late', delta: diffMin, message: `${diffMin} min behind \u2014 should be at ${current.title}`, current };
      }
    }

    if (checkin.arrivedAt && !checkin.leftAt) {
      if (times.endEpoch == null) return { status: 'on-track', delta: 0, message: `At ${current.title}`, current };
      const leftMin = Math.round((times.endEpoch - nowMs) / 60000);
      if (leftMin > 15) return { status: 'on-track', delta: 0, message: `At ${current.title} \u2014 ${leftMin} min remaining`, current };
      if (leftMin > 0) return { status: 'late', delta: 0, message: `Wrap up soon! ${leftMin} min left at ${current.title}`, current };
      return { status: 'late', delta: Math.abs(leftMin), message: `${Math.abs(leftMin)} min over planned time at ${current.title}`, current };
    }

    return { status: 'on-track', delta: 0, message: 'Moving along!', current };
  },

  // ===== Schedule Adjustment =====

  /**
   * When user taps "Leaving" for an activity, calculate the delta (in minutes)
   * between the planned end time and NOW. Store that delta so subsequent activities
   * on the same day shift accordingly.
   * New signature: no departureTime param — uses nowEpoch() directly.
   */
  adjustSchedule(dayNumber, activityId) {
    if (!this.isDayToday(dayNumber)) return 0;
    const activity = this.getDayActivities(dayNumber).find(a => a.id === activityId);
    if (!activity) return 0;
    const plannedEnd = this.getEndEpoch(activity);
    if (plannedEnd == null) return 0;
    const newDelta = Math.round((this.nowEpoch() - plannedEnd) / 60000);
    Storage.setDayAdjustment(dayNumber, newDelta);
    return newDelta;
  },

  // ===== Type Helpers =====

  getTypeIcon(type) {
    const icons = { travel:'\ud83d\ude97', meal:'\ud83c\udf7d\ufe0f', visit:'\ud83d\udccd', checkin:'\ud83c\udfe8', checkout:'\ud83d\udce6', rest:'\ud83d\ude34', errand:'\ud83d\uded2', free:'\ud83c\udf34' };
    return icons[type] || '\ud83d\udccc';
  },
  getTypeLabel(type) {
    const labels = { travel:'Drive', meal:'Food', visit:'Visit', checkin:'Check-in', checkout:'Checkout', rest:'Rest', errand:'Errand', free:'Free Time' };
    return labels[type] || type;
  }
};
"""

path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'app', 'schedule-engine.js')
with open(path, 'w', encoding='utf-8') as f:
    f.write(CONTENT.lstrip('\n'))
print(f"✅ Wrote {os.path.getsize(path)} bytes → {path}")
