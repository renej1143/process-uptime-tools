import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formatUptime, formatUptimeFrom, splitUptime } from '../src/core.js';

const MS = { s: 1000, m: 60000, h: 3600000, d: 86400000 };

test('formats a simple second count', () => {
  assert.equal(formatUptime(45 * MS.s), '45s');
});

test('formats minutes and seconds with default precision', () => {
  assert.equal(formatUptime(3 * MS.m + 7 * MS.s), '3m 7s');
});

test('formats days, hours, minutes, seconds by default', () => {
  const ms = 2 * MS.d + 3 * MS.h + 4 * MS.m + 5 * MS.s;
  assert.equal(formatUptime(ms), '2d 3h 4m 5s');
});

test('precision limits the number of components shown', () => {
  const ms = 2 * MS.d + 3 * MS.h + 4 * MS.m + 5 * MS.s;
  assert.equal(formatUptime(ms, { precision: 2 }), '2d 3h');
});

test('precision skips zero-valued leading units', () => {
  const ms = 3 * MS.h + 4 * MS.m + 5 * MS.s;
  assert.equal(formatUptime(ms, { precision: 2 }), '3h 4m');
});

test('zero duration falls back to the smallest requested unit', () => {
  assert.equal(formatUptime(0), '0ms');
  assert.equal(formatUptime(0, { units: ['h', 'm', 's'] }), '0s');
});

test('sub-second durations show milliseconds', () => {
  assert.equal(formatUptime(1500), '1s 500ms');
});

test('milliseconds can be excluded from the unit list', () => {
  assert.equal(formatUptime(1500, { units: ['s'] }), '1s');
});

test('custom unit order is preserved', () => {
  const ms = 1 * MS.h + 30 * MS.m;
  assert.equal(formatUptime(ms, { units: ['m', 'h'] }), '90m');
});

test('comma-separated units string is accepted', () => {
  assert.equal(formatUptime(90 * MS.s, { units: 'm,s' }), '1m 30s');
});

test('duplicate units are removed', () => {
  assert.equal(formatUptime(5 * MS.s, { units: ['s', 's'] }), '5s');
});

test('custom separator is used', () => {
  assert.equal(formatUptime(3 * MS.m + 7 * MS.s, { separator: ', ' }), '3m, 7s');
});

test('negative input is clamped to zero', () => {
  assert.equal(formatUptime(-5000, { units: ['s'] }), '0s');
});

test('fractional milliseconds are floored', () => {
  assert.equal(formatUptime(1999.9, { units: ['s', 'ms'] }), '1s 999ms');
});

test('unknown unit throws a RangeError', () => {
  assert.throws(() => formatUptime(1000, { units: ['x'] }), RangeError);
});

test('invalid precision throws a RangeError', () => {
  assert.throws(() => formatUptime(1000, { precision: 0 }), RangeError);
  assert.throws(() => formatUptime(1000, { precision: 1.5 }), RangeError);
});

test('invalid separator type throws a TypeError', () => {
  assert.throws(() => formatUptime(1000, { separator: 5 }), TypeError);
});

test('splitUptime returns raw components', () => {
  const parts = splitUptime(2 * MS.d + 3 * MS.h + 4 * MS.m + 5 * MS.s);
  assert.deepEqual(parts, [
    { unit: 'd', value: 2 },
    { unit: 'h', value: 3 },
    { unit: 'm', value: 4 },
    { unit: 's', value: 5 },
    { unit: 'ms', value: 0 },
  ]);
});

test('splitUptime clamps negative values', () => {
  const parts = splitUptime(-1, { units: ['s'] });
  assert.deepEqual(parts, [{ unit: 's', value: 0 }]);
});

test('formatUptimeFrom uses the injected clock', () => {
  const fakeClock = () => 3661.5; // 1h 1m 1.5s
  assert.equal(
    formatUptimeFrom({ clock: fakeClock, units: ['h', 'm', 's'] }),
    '1h 1m 1s'
  );
});

test('formatUptimeFrom floors fractional seconds to milliseconds', () => {
  const fakeClock = () => 0.0019; // 1.9 ms
  assert.equal(
    formatUptimeFrom({ clock: fakeClock, units: ['ms'] }),
    '1ms'
  );
});

test('formatUptimeFrom passes formatting options through', () => {
  const fakeClock = () => 125; // 2m 5s
  assert.equal(
    formatUptimeFrom({ clock: fakeClock, precision: 1, separator: '|' }),
    '2m'
  );
});
