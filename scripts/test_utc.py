#!/usr/bin/env python3
"""Sanity check for the UTC-converted itinerary data."""

import json
import os
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

with open(os.path.join(ROOT, "data", "itinerary.json")) as f:
    data = json.load(f)

TZ_ABBRS = {
    "America/New_York": "EDT",
    "America/Los_Angeles": "PDT",
    "America/Phoenix": "MST",
    "America/Denver": "MDT",
}

TZ_OFFSETS = {
    "America/New_York": -4,
    "America/Los_Angeles": -7,
    "America/Phoenix": -7,
    "America/Denver": -6,
}


def fmt_local(utc_str, tz_name):
    from datetime import timedelta, timezone as tz
    dt = datetime.strptime(utc_str, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=tz.utc)
    off = TZ_OFFSETS.get(tz_name, 0)
    local = dt + timedelta(hours=off)
    h = local.hour % 12 or 12
    ampm = "AM" if local.hour < 12 else "PM"
    return f"{h}:{local.minute:02d} {ampm}"


days = data["days"]
errors = []

print("=== Schedule Engine UTC Sanity Check ===\n")

# ── Day 1: Newark flight (EDT) ──
d1 = days[0]["activities"]
a = d1[0]
print(f"Day 1 ({len(d1)} activities)")
print(f"  First: {a['title']}")
print(f"  startTimeUTC: {a['startTimeUTC']}")
print(f"  endTimeUTC:   {a['endTimeUTC']}")
print(f"  Start display: {fmt_local(a['startTimeUTC'], a['timezone'])} {TZ_ABBRS.get(a['timezone'], '?')}")
print(f"  TZ: {a['timezone']}")
if "22:59" not in a["startTimeUTC"]:
    errors.append(f"d1a1 start expected *22:59*Z, got {a['startTimeUTC']}")
if a["timezone"] != "America/New_York":
    errors.append(f"d1a1 TZ expected America/New_York, got {a['timezone']}")

# ── Day 5: Grand Canyon (AZ/MST) ──
d5 = days[4]["activities"]
a5 = d5[0]
print(f"\nDay 5 ({len(d5)} activities)")
print(f"  First: {a5['title']}")
print(f"  startTimeUTC: {a5['startTimeUTC']}")
print(f"  Start display: {fmt_local(a5['startTimeUTC'], a5['timezone'])} {TZ_ABBRS.get(a5['timezone'], '?')}")
print(f"  TZ: {a5['timezone']}")
if a5["timezone"] != "America/Phoenix":
    errors.append(f"d5a1 TZ expected America/Phoenix, got {a5['timezone']}")

# ── Day 7: Bryce Canyon (UT/MDT) ──
d7 = days[6]["activities"]
a7 = d7[0]
print(f"\nDay 7 ({len(d7)} activities)")
print(f"  First: {a7['title']}")
print(f"  startTimeUTC: {a7['startTimeUTC']}")
print(f"  Start display: {fmt_local(a7['startTimeUTC'], a7['timezone'])} {TZ_ABBRS.get(a7['timezone'], '?')}")
print(f"  TZ: {a7['timezone']}")
if a7["timezone"] != "America/Denver":
    errors.append(f"d7a1 TZ expected America/Denver, got {a7['timezone']}")

# ── Day 8: Return flight ──
d8 = days[7]["activities"]
last = d8[-1]
print(f"\nDay 8 ({len(d8)} activities)")
print(f"  Last: {last['title']}")
print(f"  startTimeUTC: {last['startTimeUTC']}")
print(f"  endTimeUTC:   {last['endTimeUTC']}")
print(f"  Start display: {fmt_local(last['startTimeUTC'], last['timezone'])} {TZ_ABBRS.get(last['timezone'], '?')}")
print(f"  TZ: {last['timezone']}")
if last["timezone"] != "America/Los_Angeles":
    errors.append(f"d8a10 TZ expected America/Los_Angeles, got {last['timezone']}")

# ── Field coverage ──
print("\n--- Field Coverage ---")
total = missing_start = missing_end = missing_tz = 0
for day in days:
    for act in day["activities"]:
        total += 1
        if "startTimeUTC" not in act:
            missing_start += 1
        if "endTimeUTC" not in act:
            missing_end += 1
        if "timezone" not in act:
            missing_tz += 1
        if "plannedStart" in act:
            errors.append(f"{act['id']}: still has plannedStart!")
        if "plannedEnd" in act:
            errors.append(f"{act['id']}: still has plannedEnd!")
        if "startTimeUTC" in act and "endTimeUTC" in act:
            s = datetime.strptime(act["startTimeUTC"], "%Y-%m-%dT%H:%M:%SZ")
            e = datetime.strptime(act["endTimeUTC"], "%Y-%m-%dT%H:%M:%SZ")
            if e <= s:
                errors.append(f"{act['id']}: end <= start! {act['startTimeUTC']} -> {act['endTimeUTC']}")

print(f"  Total activities: {total}")
print(f"  Missing startTimeUTC: {missing_start}")
print(f"  Missing endTimeUTC: {missing_end}")
print(f"  Missing timezone: {missing_tz}")

# ── Cross-timezone spot checks ──
print("\n--- Cross-Timezone Spot Checks ---")

checks = [
    ("d1a1", 0, 0, "America/New_York", "Newark flight (EDT)"),
    ("d4a1", 3, 0, "America/Los_Angeles", "Henderson NV (PDT)"),
    ("d4a5", 3, 4, "America/Phoenix", "Kingman AZ (MST)"),
    ("d6a1", 5, 0, "America/Phoenix", "Page AZ (MST)"),
    ("d6a4", 5, 3, "America/Denver", "Kanab UT (MDT)"),
    ("d7a1", 6, 0, "America/Denver", "Ruby's Inn UT (MDT)"),
    ("d7a9", 6, 8, "America/Los_Angeles", "Luxor Vegas (PDT)"),
]

for aid, day_idx, act_idx, expected_tz, label in checks:
    act = days[day_idx]["activities"][act_idx]
    ok = act["timezone"] == expected_tz
    symbol = "PASS" if ok else "FAIL"
    print(f"  [{symbol}] {aid} {label}: tz={act['timezone']}")
    if not ok:
        errors.append(f"{aid} expected {expected_tz}, got {act['timezone']}")

# d7a8: Zion->Vegas drive
d7a8 = [a for a in days[6]["activities"] if a["id"] == "d7a8"][0]
ok = d7a8["timezone"] == "America/Denver"
print(f"  [{'PASS' if ok else 'FAIL'}] d7a8 Zion->Vegas drive: tz={d7a8['timezone']}")
if not ok:
    errors.append(f"d7a8 expected America/Denver, got {d7a8['timezone']}")

# d8a10: Return flight
d8a10 = [a for a in days[7]["activities"] if a["id"] == "d8a10"][0]
ok = d8a10["timezone"] == "America/Los_Angeles"
print(f"  [{'PASS' if ok else 'FAIL'}] d8a10 Return flight: tz={d8a10['timezone']}")
if not ok:
    errors.append(f"d8a10 expected America/Los_Angeles, got {d8a10['timezone']}")

# ── Summary ──
print("\n" + "=" * 50)
if errors:
    print(f"FAILED: {len(errors)} error(s):")
    for e in errors:
        print(f"  - {e}")
else:
    print("ALL CHECKS PASSED! Zero errors across all 86 activities.")
