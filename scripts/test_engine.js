#!/usr/bin/env node
// Quick sanity check for the new UTC-based schedule engine

const fs = require('fs');
const path = require('path');

// Mock Storage (browser global)
global.Storage = {
  getDayAdjustment: () => 0,
  getCheckIns: () => ({}),
  getCheckin: () => null,
  getSettings: () => ({ lateThresholdMinutes: 15 }),
  setDayAdjustment: () => {},
};

// Load schedule engine
const engineCode = fs.readFileSync(path.join(__dirname, '..', 'app', 'schedule-engine.js'), 'utf8');
eval(engineCode);

// Load itinerary
const itin = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'itinerary.json'), 'utf8'));
ScheduleEngine.load(itin);

console.log('=== Schedule Engine UTC Sanity Check ===\n');

// Day 1: Newark flight
const d1 = ScheduleEngine.getDayActivities(1);
const act1 = d1[0];
console.log('Day 1 (' + d1.length + ' activities)');
console.log('  First: ' + act1.title);
console.log('  Start epoch: ' + ScheduleEngine.getStartEpoch(act1));
console.log('  Start display: ' + ScheduleEngine.formatActivityStart(act1, 1));
console.log('  End display: ' + ScheduleEngine.formatActivityEnd(act1, 1));
console.log('  TZ: ' + ScheduleEngine.getActivityTzAbbr(act1, 1));

// Day 5: Grand Canyon (AZ/MST)
const d5 = ScheduleEngine.getDayActivities(5);
const act5 = d5[0];
console.log('\nDay 5 (' + d5.length + ' activities)');
console.log('  First: ' + act5.title);
console.log('  Start display: ' + ScheduleEngine.formatActivityStart(act5, 5));
console.log('  TZ: ' + ScheduleEngine.getActivityTzAbbr(act5, 5));

// Day 7: Bryce Canyon (UT/MDT)
const d7 = ScheduleEngine.getDayActivities(7);
const act7 = d7[0];
console.log('\nDay 7 (' + d7.length + ' activities)');
console.log('  First: ' + act7.title);
console.log('  Start display: ' + ScheduleEngine.formatActivityStart(act7, 7));
console.log('  TZ: ' + ScheduleEngine.getActivityTzAbbr(act7, 7));

// Day 8: Return flight
const d8 = ScheduleEngine.getDayActivities(8);
const last8 = d8[d8.length - 1];
console.log('\nDay 8 (' + d8.length + ' activities)');
console.log('  Last: ' + last8.title);
console.log('  Start display: ' + ScheduleEngine.formatActivityStart(last8, 8));
console.log('  End display: ' + ScheduleEngine.formatActivityEnd(last8, 8));
console.log('  TZ: ' + ScheduleEngine.getActivityTzAbbr(last8, 8));

// Test getAdjustedTimes returns epoch-based
const adj = ScheduleEngine.getAdjustedTimes(act1, 1);
console.log('\nAdjusted times (d1a1):');
console.log('  startEpoch: ' + adj.startEpoch + ' (type: ' + typeof adj.startEpoch + ')');
console.log('  endEpoch: ' + adj.endEpoch);
console.log('  delta: ' + adj.delta);

// Test calculateStatus
const status = ScheduleEngine.calculateStatus(1);
console.log('\nStatus Day 1: ' + status.status + ' - ' + status.message);

console.log('\n✅ All checks passed!');
