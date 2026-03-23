// ===== ui.js — DOM rendering for ChetanSmartTrip =====

const UI = {

  /** Render the day header section */
  renderDayHeader(day) {
    document.getElementById('day-number').textContent = `Day ${day.dayNumber} — ${day.dayOfWeek}`;
    document.getElementById('day-title').textContent = day.title;
    document.getElementById('day-date').textContent = day.date;
  },

  /** Render weather banner */
  renderWeather(day) {
    const weather = day.weather;
    if (!weather) return;

    const icon = this._weatherIcon(weather.summary);
    document.getElementById('weather-icon').textContent = icon;
    document.getElementById('weather-text').textContent = weather.summary +
      (weather.tips ? ' — ' + weather.tips : '');
  },

  _weatherIcon(summary) {
    const s = summary.toLowerCase();
    if (s.includes('rain')) return '🌧️';
    if (s.includes('snow')) return '❄️';
    if (s.includes('cloud')) return '☁️';
    if (s.includes('clear') || s.includes('sunny')) return '☀️';
    return '🌤️';
  },

  /** Render current activity card */
  renderCurrentActivity(activity, dayNumber, status) {
    if (!activity) {
      document.getElementById('current-title').textContent = 'No current activity';
      document.getElementById('current-time').textContent = '';
      document.getElementById('current-notes').textContent = '';
      return;
    }

    const times = ScheduleEngine.getAdjustedTimes(activity, dayNumber);
    const checkin = Storage.getCheckin(activity.id);

    document.getElementById('current-title').textContent =
      ScheduleEngine.getTypeIcon(activity.type) + ' ' + activity.title;

    // Time display
    let timeText = '';
    if (times.start != null) {
      timeText = ScheduleEngine.formatTime(times.start);
      if (times.end != null) timeText += ' → ' + ScheduleEngine.formatTime(times.end);
    }
    if (times.delta !== 0) {
      const dir = times.delta > 0 ? 'late' : 'early';
      timeText += ` (adjusted ${Math.abs(times.delta)} min ${dir})`;
    }
    document.getElementById('current-time').textContent = timeText;

    // Notes
    document.getElementById('current-notes').textContent = activity.notes || '';

    // Status badge
    const badge = document.getElementById('current-status-badge');
    badge.className = 'status-badge ' + (status?.status || 'waiting');
    if (status?.status === 'on-track') badge.textContent = '✓ On Track';
    else if (status?.status === 'early') badge.textContent = `⏩ ${status.delta}m early`;
    else if (status?.status === 'late') badge.textContent = `⏰ ${status.delta}m late`;
    else if (status?.status === 'very-late') badge.textContent = `🚨 ${status.delta}m behind`;
    else badge.textContent = 'Waiting';

    // Confirmation number
    const confEl = document.getElementById('current-confirmation');
    const conf = activity.confirmation || (activity.type === 'checkin' ? this._findHotelConfirmation(dayNumber) : null);
    if (conf) {
      confEl.textContent = `📋 Confirmation: ${conf}`;
      confEl.classList.remove('hidden');
    } else {
      confEl.classList.add('hidden');
    }

    // What to do
    const whatEl = document.getElementById('current-what-to-do');
    if (activity.whatToDo && activity.whatToDo.length > 0) {
      whatEl.innerHTML = '<h4>What To Do Here</h4><ul>' +
        activity.whatToDo.map(item => `<li>${item}</li>`).join('') + '</ul>';
      whatEl.classList.remove('hidden');
    } else {
      whatEl.classList.add('hidden');
    }

    // Tips
    const tipsEl = document.getElementById('current-tips');
    if (activity.tips && activity.tips.length > 0) {
      tipsEl.innerHTML = '<h4>Tips</h4><ul>' +
        activity.tips.map(tip => `<li>${tip}</li>`).join('') + '</ul>';
      tipsEl.classList.remove('hidden');
    } else {
      tipsEl.classList.add('hidden');
    }

    // Buttons state
    const btnArrived = document.getElementById('btn-arrived');
    const btnLeaving = document.getElementById('btn-leaving');

    if (checkin?.arrivedAt && checkin?.leftAt) {
      btnArrived.disabled = true;
      btnLeaving.disabled = true;
      btnArrived.textContent = '✅ Done';
      btnLeaving.textContent = '✅ Done';
    } else if (checkin?.arrivedAt) {
      btnArrived.disabled = true;
      btnLeaving.disabled = false;
      btnArrived.textContent = '✅ Arrived';
      btnLeaving.textContent = '🚪 Leaving';
    } else {
      btnArrived.disabled = false;
      btnLeaving.disabled = true;
      btnArrived.textContent = '✅ I\'m Here';
      btnLeaving.textContent = '🚪 Leaving';
    }
  },

  _findHotelConfirmation(dayNumber) {
    const day = ScheduleEngine.getTripDayByNumber(dayNumber);
    return day?.hotel?.confirmation || null;
  },

  /** Render next activity card */
  renderNextActivity(activity, dayNumber) {
    if (!activity) {
      document.getElementById('next-card').classList.add('hidden');
      return;
    }
    document.getElementById('next-card').classList.remove('hidden');

    const times = ScheduleEngine.getAdjustedTimes(activity, dayNumber);

    document.getElementById('next-title').textContent =
      ScheduleEngine.getTypeIcon(activity.type) + ' ' + activity.title;

    let timeText = '';
    if (times.start != null) timeText = ScheduleEngine.formatTime(times.start);
    if (times.end != null) timeText += ' → ' + ScheduleEngine.formatTime(times.end);
    document.getElementById('next-time').textContent = timeText;

    // Distance
    const dist = activity.distance;
    if (dist) {
      document.getElementById('next-distance').textContent =
        `📍 ${dist.miles} mi · ~${dist.estimatedMinutes} min ${dist.route ? '(' + dist.route + ')' : ''}`;
    } else {
      document.getElementById('next-distance').textContent = '';
    }

    // ETA — only show real-time countdown for today
    if (times.start != null && ScheduleEngine.isDayToday(dayNumber)) {
      const minsUntil = times.start - ScheduleEngine.nowMinutes();
      document.getElementById('next-eta').textContent =
        minsUntil > 0 ? `in ${minsUntil} min` : 'now';
    } else if (times.start != null) {
      document.getElementById('next-eta').textContent = ScheduleEngine.formatTime(times.start);
    }

    document.getElementById('next-notes').textContent = activity.notes || '';
  },

  /** Render hotel card */
  renderHotel(day) {
    const hotel = day.hotel;
    if (!hotel) {
      document.getElementById('hotel-card').classList.add('hidden');
      return;
    }
    document.getElementById('hotel-card').classList.remove('hidden');
    document.getElementById('hotel-name').textContent = hotel.name;
    document.getElementById('hotel-address').textContent = hotel.address || '';
    document.getElementById('hotel-phone').textContent = hotel.phone ? `📞 ${hotel.phone}` : '';
  },

  /** Currently expanded activity id in timeline */
  _expandedActivityId: null,

  /** Render timeline */
  renderTimeline(dayNumber) {
    const activities = ScheduleEngine.getDayActivities(dayNumber);
    const checkins = Storage.getCheckIns();
    const container = document.getElementById('timeline-list');
    container.innerHTML = '';

    const isToday = ScheduleEngine.isDayToday(dayNumber);
    const isPast = ScheduleEngine.isDayPast(dayNumber);
    const isFuture = ScheduleEngine.isDayFuture(dayNumber);
    const now = isToday ? ScheduleEngine.nowMinutes() : null;
    const currentActivity = ScheduleEngine.findCurrentActivity(dayNumber);

    activities.forEach(act => {
      const times = ScheduleEngine.getAdjustedTimes(act, dayNumber);
      const ci = checkins[act.id];
      const isCurrent = currentActivity && currentActivity.id === act.id;
      const isExpanded = this._expandedActivityId === act.id;

      // Determine status based on date context
      let dotClass = 'upcoming';
      let itemClass = 'upcoming';

      if (ci && ci.leftAt) {
        // Has explicit check-out data — always show as completed
        dotClass = 'completed';
        itemClass = 'completed';
      } else if (ci && ci.arrivedAt) {
        // Has explicit check-in — always show as current/active
        dotClass = 'current';
        itemClass = 'current';
      } else if (isFuture) {
        // Future day with no check-in data — all upcoming
        dotClass = 'upcoming';
        itemClass = 'upcoming';
      } else if (isPast) {
        // Past day with no check-in data — all completed/skipped
        dotClass = 'skipped';
        itemClass = 'completed';
      } else if (isToday && isCurrent) {
        // Today + this is the current activity by time
        dotClass = 'current';
        itemClass = 'current';
      } else if (isToday && times.end != null && now > times.end) {
        // Today + time window has passed
        dotClass = 'skipped';
        itemClass = 'completed';
      }

      const el = document.createElement('div');
      el.className = `timeline-item ${itemClass}${isExpanded ? ' expanded' : ''}`;
      el.dataset.activityId = act.id;

      const timeStr = times.start != null ? ScheduleEngine.formatTime(times.start) : '';
      const endStr = times.end != null ? ScheduleEngine.formatTime(times.end) : '';

      let adjustedStr = '';
      if (times.delta !== 0 && times.start != null) {
        adjustedStr = `<span class="timeline-adjusted">(${times.delta > 0 ? '+' : ''}${times.delta}m)</span>`;
      }

      // Checkin status indicator
      let checkinBadge = '';
      if (ci && ci.leftAt) {
        checkinBadge = '<span class="tl-badge tl-badge-done">✓ Done</span>';
      } else if (ci && ci.arrivedAt) {
        checkinBadge = '<span class="tl-badge tl-badge-here">Here</span>';
      }

      // Build the header row (always visible)
      let html = `
        <div class="timeline-header">
          <span class="timeline-type-icon">${ScheduleEngine.getTypeIcon(act.type)}</span>
          <span class="timeline-dot ${dotClass}"></span>
          <div class="timeline-info">
            <div class="timeline-title">${act.title} ${checkinBadge}</div>
            <div class="timeline-time">${timeStr}${endStr ? ' → ' + endStr : ''} ${adjustedStr}</div>
          </div>
          <span class="timeline-chevron">${isExpanded ? '▾' : '▸'}</span>
        </div>
      `;

      // Build the expandable detail section
      if (isExpanded) {
        html += this._buildActivityExpanded(act, dayNumber, ci);
      }

      el.innerHTML = html;

      // Click header to toggle expand
      el.querySelector('.timeline-header').addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._expandedActivityId === act.id) {
          this._expandedActivityId = null;
        } else {
          this._expandedActivityId = act.id;
        }
        this.renderTimeline(dayNumber);
      });

      // Bind arrive/leave buttons if expanded
      if (isExpanded) {
        const arrBtn = el.querySelector('.tl-btn-arrive');
        const leaveBtn = el.querySelector('.tl-btn-leave');
        if (arrBtn) {
          arrBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            App.handleArrivalFor(act.id, dayNumber);
          });
        }
        if (leaveBtn) {
          leaveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            App.handleDepartureFor(act.id, dayNumber);
          });
        }
      }

      container.appendChild(el);
    });
  },

  /** Build the expanded detail HTML for a timeline activity */
  _buildActivityExpanded(activity, dayNumber, checkin) {
    const times = ScheduleEngine.getAdjustedTimes(activity, dayNumber);
    let html = '<div class="tl-expanded">';

    // Notes
    if (activity.notes) {
      html += `<p class="tl-notes">${activity.notes}</p>`;
    }

    // Duration
    if (activity.duration) {
      html += `<p class="tl-meta">⏱ Duration: ${activity.duration} min</p>`;
    }

    // Distance
    if (activity.distance) {
      html += `<p class="tl-meta">📍 ${activity.distance.miles} mi · ~${activity.distance.estimatedMinutes} min`;
      if (activity.distance.route) html += ` via ${activity.distance.route}`;
      html += '</p>';
    }

    // Confirmation
    if (activity.confirmation) {
      html += `<div class="tl-confirmation">📋 #${activity.confirmation}</div>`;
    }

    // What to do
    if (activity.whatToDo && activity.whatToDo.length > 0) {
      html += '<div class="tl-section"><h5>🎯 What To Do</h5><ul>';
      activity.whatToDo.forEach(w => { html += `<li>${w}</li>`; });
      html += '</ul></div>';
    }

    // Tips
    if (activity.tips && activity.tips.length > 0) {
      html += '<div class="tl-section"><h5>💡 Tips</h5><ul>';
      activity.tips.forEach(t => { html += `<li>${t}</li>`; });
      html += '</ul></div>';
    }

    // Arrive / Leave buttons for THIS activity
    const arrivedDisabled = (checkin && checkin.arrivedAt) ? 'disabled' : '';
    const leaveDisabled = (!checkin || !checkin.arrivedAt || checkin.leftAt) ? 'disabled' : '';

    let arrLabel = '✅ I\'m Here';
    let leaveLabel = '🚪 Leaving';
    if (checkin && checkin.leftAt) {
      arrLabel = '✅ Done';
      leaveLabel = '✅ Done';
    } else if (checkin && checkin.arrivedAt) {
      arrLabel = '✅ Arrived';
    }

    html += `
      <div class="tl-actions">
        <button class="btn-action btn-arrive tl-btn-arrive" ${arrivedDisabled}>${arrLabel}</button>
        <button class="btn-action btn-leave tl-btn-leave" ${leaveDisabled}>${leaveLabel}</button>
      </div>
    `;

    // Show check-in timestamps if available
    if (checkin && checkin.arrivedAt) {
      html += `<p class="tl-checkin-info">Arrived: ${ScheduleEngine.formatTime(checkin.arrivedAt)}`;
      if (checkin.leftAt) html += ` · Left: ${ScheduleEngine.formatTime(checkin.leftAt)}`;
      html += '</p>';
    }

    html += '</div>';
    return html;
  },

  /** Render expenses */
  renderExpenses(dayNumber) {
    const expenses = Storage.getDayExpenses(dayNumber);
    const container = document.getElementById('expense-list');
    container.innerHTML = '';

    expenses.forEach(exp => {
      const row = document.createElement('div');
      row.className = 'expense-row';
      row.innerHTML = `
        <span class="expense-desc">${exp.description}</span>
        <span class="expense-amt">$${exp.amount.toFixed(2)}</span>
      `;
      container.appendChild(row);
    });

    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    document.getElementById('expense-total').textContent =
      total > 0 ? `Today: $${total.toFixed(2)}` : '';
  },

  /** Render status bar */
  renderStatusBar(status) {
    const icon = document.getElementById('status-icon');
    const text = document.getElementById('status-text');

    icon.className = status?.status || '';
    text.textContent = status?.message || 'Ready';

    // Update clock
    document.getElementById('clock').textContent =
      ScheduleEngine.formatDate(new Date());
  },

  // ===== Morning Briefing =====

  showMorningBriefing(day) {
    const overlay = document.getElementById('morning-briefing');
    overlay.classList.remove('hidden');

    document.getElementById('briefing-title').textContent =
      `🌅 Day ${day.dayNumber}: ${day.title}`;

    // Weather
    const weatherEl = document.getElementById('briefing-weather');
    const w = day.weather;
    if (w) {
      weatherEl.innerHTML = `<h3>☀️ Weather</h3><p>${w.summary}</p><p>${w.tips || ''}</p>`;
    }

    // Highlights
    const highlightsEl = document.getElementById('briefing-highlights');
    if (day.highlights && day.highlights.length) {
      highlightsEl.innerHTML = '<h3>⭐ Today\'s Highlights</h3>' +
        day.highlights.map(h => `<p>${h}</p>`).join('');
    }

    // Tips
    const tipsEl = document.getElementById('briefing-tips');
    if (day.dailyTips && day.dailyTips.length) {
      tipsEl.innerHTML = '<h3>💡 Tips for Today</h3>' +
        day.dailyTips.map(t => `<p>• ${t}</p>`).join('');
    }
  },

  hideMorningBriefing() {
    document.getElementById('morning-briefing').classList.add('hidden');
  },

  // ===== Confirmation Overlay =====

  showConfirmation(day) {
    const overlay = document.getElementById('confirmation-overlay');
    overlay.classList.remove('hidden');

    const hotel = day.hotel;
    let html = '';
    if (hotel) {
      html += `<div style="margin-bottom:12px">
        <strong>🏨 ${hotel.name}</strong><br>
        <span style="color: var(--accent-light); font-size: 20px; font-weight: 700;">
          #${hotel.confirmation}
        </span><br>
        <span style="color: var(--text-muted); font-size: 13px;">${hotel.address || ''}</span><br>
        <span style="color: var(--text-muted); font-size: 13px;">${hotel.phone || ''}</span><br>
        <span style="color: var(--green); font-size: 13px;">$${hotel.cost?.toFixed(2) || '—'}/night</span>
      </div>`;
    }
    document.getElementById('confirmation-details').innerHTML = html;
  },

  hideConfirmation() {
    document.getElementById('confirmation-overlay').classList.add('hidden');
  },

  // ===== Overview View =====

  renderOverview(itinerary, currentDayNum) {
    const container = document.getElementById('overview-days');
    container.innerHTML = '';

    itinerary.days.forEach(day => {
      const card = document.createElement('div');
      card.className = 'overview-day-card' + (day.dayNumber === currentDayNum ? ' today' : '');
      card.innerHTML = `
        <h3>Day ${day.dayNumber} — ${day.dayOfWeek}, ${day.date}</h3>
        <p>${day.title}</p>
        <div class="highlight-list">${(day.highlights || []).join(' · ')}</div>
      `;
      card.addEventListener('click', () => {
        App.switchToDay(day.dayNumber);
      });
      container.appendChild(card);
    });
  },

  // ===== Emergency View =====

  renderEmergency(itinerary) {
    const container = document.getElementById('emergency-content');
    let html = '';

    // Emergency number
    html += `<div class="emergency-card">
      <h3>🆘 Emergency</h3>
      <a href="tel:911">📞 911 — Police, Fire, Medical</a>
    </div>`;

    // Rental cars
    html += `<div class="emergency-card">
      <h3>🚗 Rental Car Roadside</h3>
      <a href="tel:18006543131">Hertz: 1-800-654-3131</a>
      <a href="tel:18003527900">Avis: 1-800-352-7900</a>
    </div>`;

    // Hotels
    html += `<div class="emergency-card"><h3>🏨 Hotels</h3>`;
    itinerary.days.forEach(day => {
      if (day.hotel && day.hotel.phone) {
        html += `<a href="tel:${day.hotel.phone.replace(/[^+0-9]/g, '')}">
          Day ${day.dayNumber}: ${day.hotel.name} — ${day.hotel.phone}
          <br><small style="color: var(--text-muted);">#${day.hotel.confirmation}</small>
        </a>`;
      }
    });
    html += '</div>';

    // Hospitals
    if (itinerary.emergencyContacts?.hospitals) {
      html += `<div class="emergency-card"><h3>🏥 Nearest Hospitals</h3>`;
      itinerary.emergencyContacts.hospitals.forEach(h => {
        html += `<a href="tel:${h.phone.replace(/[^+0-9]/g, '')}">${h.name}: ${h.phone}</a>`;
      });
      html += '</div>';
    }

    // National Parks
    html += `<div class="emergency-card"><h3>🌲 National Parks</h3>
      <a href="tel:7607863200">Death Valley: (760) 786-3200</a>
      <a href="tel:9286387888">Grand Canyon: (928) 638-7888</a>
      <a href="tel:4358345322">Bryce Canyon: (435) 834-5322</a>
      <a href="tel:4357723256">Zion: (435) 772-3256</a>
    </div>`;

    // Antelope Canyon Tour
    html += `<div class="emergency-card"><h3>🎫 Tour Booking</h3>
      <a href="tel:9286459102">Dixie's Lower Antelope: (928) 645-9102</a>
    </div>`;

    container.innerHTML = html;
  }
};
