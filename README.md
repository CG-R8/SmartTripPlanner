# 🗺️ ChetanSmartTrip — Smart Travel Companion PWA

A Progressive Web App built for the Chetan family's Southwest USA road trip  
**March 24–31, 2026** · Newark → LA → Death Valley → Vegas → Grand Canyon → Antelope Canyon → Bryce → Zion → Vegas → Newark

---

## What It Does

| Feature | How It Works |
|---------|-------------|
| **Schedule Tracking** | Compare current time vs planned itinerary → shows on-track / early / late |
| **Manual Check-ins** | Tap "I Arrived" / "I'm Leaving" buttons (no GPS drain) |
| **Smart Notifications** | Browser notification + voice alert when running behind schedule |
| **Morning Briefing** | Daily overlay with weather, hotel info, key highlights |
| **Confirmation Numbers** | One-tap access to hotel, rental car, flight confirmations |
| **Schedule Adjustment** | If you leave late, subsequent activities auto-adjust |
| **Expense Tracker** | Log expenses per day, see running total |
| **Offline Mode** | Full offline support via Service Worker — works in airplane mode |
| **Dark Mode** | AMOLED-optimized dark theme for battery savings |

---

## Tech Stack

- **Pure vanilla JS** — zero dependencies, zero build tools
- **PWA** — installable on phone home screen
- **Service Worker** — offline-first caching
- **LocalStorage** — persists check-ins, expenses, settings
- **Notification API + SpeechSynthesis** — alerts you without looking at screen

---

## Quick Start

### 1. Serve Locally

```bash
cd "/Users/chetan/My Projects/SouthWestTrip/ChetanSmartTrip"
python serve.py
```

This starts a local server on port 8080.

### 2. Open on Phone

Both your **laptop** and **Samsung S23** must be on the **same WiFi**.

1. The server prints a Network URL (e.g., `http://192.168.1.xx:8080/app/`)
2. Open that URL in **Chrome** on your Samsung S23
3. Tap the **⋮ menu → "Add to Home Screen"**
4. The app is now installed as a PWA!

### 3. Allow Notifications

When prompted, tap **Allow** for notifications. This enables:
- Browser push notifications
- Voice announcements (e.g., "You're running 15 minutes behind")

---

## Project Structure

```
ChetanSmartTrip/
├── serve.py              # Local HTTP server (run this!)
├── PLANNING.md           # Design document & architecture
├── README.md             # You are here
├── data/
│   └── itinerary.json    # Complete 8-day trip data
├── app/
│   ├── manifest.json     # PWA manifest
│   ├── index.html        # App shell (single page)
│   ├── style.css         # Mobile-first dark mode CSS
│   ├── storage.js        # LocalStorage wrapper
│   ├── schedule-engine.js # Core time/schedule logic
│   ├── notifications.js  # Browser notifications + voice
│   ├── ui.js             # DOM rendering
│   ├── app.js            # Main entry point
│   └── sw.js             # Service Worker (offline)
└── DetailedItineray/     # Source itinerary markdown files
    ├── Day1*.md through Day8*.md
```

---

## How To Use During The Trip

### Daily Workflow

1. **Morning**: Open app → dismiss morning briefing (weather, tips, highlights)
2. **At each stop**: Tap **"I Arrived"** → see what to do, tips, confirmation numbers
3. **Leaving**: Tap **"I'm Leaving"** → app calculates delay, adjusts schedule
4. **Driving**: Voice alerts will tell you if you're running late
5. **Evening**: Check expenses, review next day's overview

### Bottom Navigation

| Tab | What It Shows |
|-----|--------------|
| **Today** | Current day's schedule, activity cards, timeline |
| **Overview** | All 8 days at a glance |
| **Emergency** | Hotel confirmations, emergency contacts, park numbers |
| **Settings** | Notifications on/off, voice on/off, update interval, export data |

### Status Colors

- 🟢 **Green** = On track (within 5 min of plan)
- 🟡 **Yellow** = Running 5–20 min behind
- 🔴 **Red** = Running 20+ min behind

---

## Samsung S23 Tips

1. **Disable battery optimization for Chrome**: Settings → Battery → Background usage limits → Never sleeping apps → Add Chrome
2. **Keep screen on while driving**: Settings → Display → Screen timeout → 10 minutes
3. **Enable notifications**: Settings → Apps → Chrome → Notifications → Allow

---

## Trip Highlights

| Day | Date | Route | Key Stops |
|-----|------|-------|-----------|
| 1 | Mar 24 | Newark → LAX | Spirit NK 1670, Hertz pickup |
| 2 | Mar 25 | LA → Ridgecrest | Rodeo Drive, Hollywood Sign, Griffith Observatory |
| 3 | Mar 26 | Death Valley → Vegas | Artist's Palette, Badwater Basin, ⚠️ Midnight Car Swap |
| 4 | Mar 27 | Vegas → Grand Canyon | Hoover Dam, Grand Canyon Sunset |
| 5 | Mar 28 | Grand Canyon → Page | ⚠️ Antelope Canyon 12:15 PM (CRITICAL), Horseshoe Bend |
| 6 | Mar 29 | Page → Bryce Canyon | Sunset Point, Rim Trail, Inspiration Point |
| 7 | Mar 30 | Bryce → Zion → Vegas | Zion Canyon, Vegas Strip Evening |
| 8 | Mar 31 | Vegas → Newark | Pool day, United UA 1681 10:40 PM |

---

## Offline Mode

The app works fully offline after the first load:
- All HTML/CSS/JS cached by Service Worker
- Itinerary data cached locally
- Check-ins stored in LocalStorage
- No internet needed during the trip!

---

## Data Export

Go to **Settings → Export Trip Log** to download a JSON file with:
- All check-in/check-out timestamps
- Schedule adjustments
- Expenses
- Settings

Great for post-trip review!

---

*Built with ❤️ for the Chetan family road trip. Safe travels! 🚗*
