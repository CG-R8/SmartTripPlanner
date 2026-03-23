#!/usr/bin/env python3
"""
Convert itinerary.json times to UTC ISO-8601.

Each activity gets:
  - startTimeUTC: "2026-03-24T22:59:00Z"
  - endTimeUTC:   "2026-03-25T05:14:00Z"
  - timezone:     IANA timezone for the activity's LOCATION (for display)
  - (planned start/end HH:MM fields removed)

Timezone mapping based on ACTUAL location of each activity:
  - March 24-31 2026 is during US Daylight Saving Time (started Mar 8)
  - EDT  = UTC-4  (New York, Newark)
  - PDT  = UTC-7  (California, Nevada, Oregon)
  - MST  = UTC-7  (Arizona — no DST, so same offset as PDT!)
  - MDT  = UTC-6  (Utah, Colorado with DST)
"""

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

# UTC offsets during DST (March 24-31, 2026)
TZ_OFFSETS = {
    "America/New_York":    timedelta(hours=-4),   # EDT
    "America/Los_Angeles": timedelta(hours=-7),   # PDT
    "America/Phoenix":     timedelta(hours=-7),   # MST (no DST, same as PDT)
    "America/Denver":      timedelta(hours=-6),   # MDT
}

# ── Per-activity timezone based on ACTUAL LOCATION ──
# Default: use the day-level timezone unless overridden here
ACTIVITY_TZ_OVERRIDES = {
    # Day 1: Flight departs Newark (EDT), arrives LAX (PDT)
    "d1a1": {
        "startTz": "America/New_York",      # Departing from Newark = EDT
        "endTz":   "America/Los_Angeles",    # Arriving at LAX = PDT
        "displayTz": "America/New_York",     # Show departure TZ
    },
    # Day 1: d1a2-d1a6 are all at LAX/LA = PDT (matches day TZ, no override needed)

    # Day 4: Henderson/Hoover Dam activities are in NV = PDT
    # But day TZ is America/Phoenix (MST). Since PDT=MST=UTC-7, offset is same!
    # Still, let's tag them with correct IANA for semantic correctness:
    "d4a1": {"tz": "America/Los_Angeles"},   # Henderson, NV
    "d4a2": {"tz": "America/Los_Angeles"},   # Henderson, NV
    "d4a3": {"tz": "America/Los_Angeles"},   # Driving from Henderson
    "d4a4": {"tz": "America/Los_Angeles"},   # Hoover Dam (NV side)
    # d4a5 onward: into AZ = America/Phoenix (matches day TZ)

    # Day 6: Page, AZ activities use MST; Bryce, UT activities use MDT
    # Day TZ is America/Denver (MDT). Page (AZ) should be MST.
    "d6a1": {"tz": "America/Phoenix"},       # Page, AZ
    "d6a2": {"tz": "America/Phoenix"},       # Page, AZ
    "d6a3": {"tz": "America/Phoenix"},       # Driving from Page (starts AZ)
    # d6a4 Kanab, UT onward: America/Denver (MDT) — matches day TZ

    # Day 7: Bryce/Zion in UT (MDT), Vegas in NV (PDT)
    # Day TZ is America/Los_Angeles (PDT). Bryce/Zion should be MDT.
    "d7a1": {"tz": "America/Denver"},        # Ruby's Inn, UT
    "d7a2": {"tz": "America/Denver"},        # Ruby's Inn, UT
    "d7a3": {"tz": "America/Denver"},        # Bryce Canyon, UT
    "d7a4": {"tz": "America/Denver"},        # Driving Bryce→Zion, starts UT
    "d7a5": {"tz": "America/Denver"},        # Zion Visitor Center, UT
    "d7a6": {"tz": "America/Denver"},        # Zion Canyon, UT
    "d7a7": {"tz": "America/Denver"},        # Springdale, UT
    # d7a8: Drive Zion→Vegas — starts MDT, ends PDT. Use start TZ.
    "d7a8": {
        "startTz": "America/Denver",
        "endTz":   "America/Los_Angeles",
        "displayTz": "America/Denver",
    },
    # d7a9 onward: Vegas = PDT (matches day TZ)

    # Day 8: Vegas activities are PDT (matches day TZ)
    # Return flight: departs Vegas (PDT), arrives Newark (EDT)
    "d8a10": {
        "startTz": "America/Los_Angeles",    # Departing Vegas = PDT
        "endTz":   "America/New_York",       # Arriving Newark = EDT
        "displayTz": "America/Los_Angeles",
    },
}


def local_to_utc(date_str: str, time_str: str, tz_name: str) -> str:
    """Convert a local date + HH:MM time + IANA timezone → UTC ISO-8601 string."""
    offset = TZ_OFFSETS[tz_name]
    # Parse local datetime
    local_dt = datetime.strptime(f"{date_str}T{time_str}:00", "%Y-%m-%dT%H:%M:%S")
    # Apply offset to get UTC
    utc_dt = local_dt - offset
    return utc_dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def get_next_date(date_str: str) -> str:
    """Get the next calendar date."""
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    return (dt + timedelta(days=1)).strftime("%Y-%m-%d")


def process_itinerary():
    root = Path(__file__).parent.parent
    src = root / "data" / "itinerary.json"
    dst = root / "data" / "itinerary.json"
    backup = root / "data" / "itinerary_pre_utc_backup.json"

    with open(src, "r") as f:
        data = json.load(f)

    # Create backup
    with open(backup, "w") as f:
        json.dump(data, f, indent=2)
    print(f"✅ Backup saved to {backup}")

    for day in data["days"]:
        day_num = day["dayNumber"]
        day_date = day["date"]
        day_tz = day["timezone"]
        next_date = get_next_date(day_date)

        print(f"\n📅 Day {day_num}: {day_date} ({day['title']})")
        print(f"   Day default TZ: {day_tz}")

        for act in day["activities"]:
            aid = act["id"]
            start_hhmm = act.get("plannedStart")
            end_hhmm = act.get("plannedEnd")

            if not start_hhmm:
                continue

            override = ACTIVITY_TZ_OVERRIDES.get(aid, {})

            # Determine timezones
            if "startTz" in override:
                # Different start/end timezones (flights, cross-TZ drives)
                start_tz = override["startTz"]
                end_tz = override["endTz"]
                display_tz = override.get("displayTz", start_tz)
            elif "tz" in override:
                start_tz = end_tz = display_tz = override["tz"]
            else:
                start_tz = end_tz = display_tz = day_tz

            # Handle times that cross midnight (e.g., 23:45 → 00:15)
            start_hour = int(start_hhmm.split(":")[0])
            end_hour = int(end_hhmm.split(":")[0]) if end_hhmm else start_hour

            start_date = day_date
            end_date = day_date

            # If end time < start time, it crosses midnight
            if end_hhmm and end_hour < start_hour:
                end_date = next_date

            # Also handle special case: if start is already past midnight
            # (e.g., d1a6 "00:15"→"00:45" on Day 1 which is March 24)
            # These are actually early hours of March 25
            if start_hour < 6 and day_num in [1, 3]:
                # Activities starting after midnight belong to next calendar day
                start_date = next_date
                end_date = next_date

            # Convert to UTC
            start_utc = local_to_utc(start_date, start_hhmm, start_tz)
            end_utc = local_to_utc(end_date, end_hhmm, end_tz) if end_hhmm else None

            # Verify: end should be after start
            if end_utc:
                s = datetime.strptime(start_utc, "%Y-%m-%dT%H:%M:%SZ")
                e = datetime.strptime(end_utc, "%Y-%m-%dT%H:%M:%SZ")
                if e < s:
                    print(f"   ⚠️  {aid}: end ({end_utc}) < start ({start_utc})! Bumping end to next day.")
                    end_date = get_next_date(end_date)
                    end_utc = local_to_utc(end_date, end_hhmm, end_tz)

            # Update the activity
            act["startTimeUTC"] = start_utc
            if end_utc:
                act["endTimeUTC"] = end_utc
            act["timezone"] = display_tz

            # Remove old fields
            if "plannedStart" in act:
                del act["plannedStart"]
            if "plannedEnd" in act:
                del act["plannedEnd"]
            # Remove the old per-activity "timezone" text like "Flight crosses EST→PST"
            # (we already set the new one above)

            # Print for verification
            local_start = f"{start_date} {start_hhmm} {start_tz.split('/')[-1]}"
            local_end = f"{end_date} {end_hhmm} {end_tz.split('/')[-1]}" if end_hhmm else "—"
            print(f"   {aid}: {act['title'][:40]:40s} | {local_start} → {local_end}")
            print(f"         UTC: {start_utc} → {end_utc or '—'}  display: {display_tz}")

    # Write output
    with open(dst, "w") as f:
        json.dump(data, f, indent=2)
    print(f"\n✅ Converted itinerary saved to {dst}")
    print(f"   Total days: {len(data['days'])}")
    total_acts = sum(len(d['activities']) for d in data['days'])
    print(f"   Total activities: {total_acts}")


if __name__ == "__main__":
    process_itinerary()
