# process-uptime-tools

Format Node.js process uptime as human-readable durations, with control over which units appear and how many of them.

## Usage

```js
import { formatUptime, formatUptimeFrom } from 'process-uptime-tools';

// From a millisecond count:
formatUptime(90061000);                          // '1d 1h 1m 1s'
formatUptime(90061000, { precision: 2 });        // '1d 1h'
formatUptime(1500, { units: ['s', 'ms'] });      // '1s 500ms'
formatUptime(1500, { separator: ', ' });         // '1s, 500ms'

// Directly from the running process:
formatUptimeFrom();                              // e.g. '3h 12m 7s'
formatUptimeFrom({ precision: 1 });              // e.g. '3h'
```

`formatUptimeFrom` also accepts a `clock` option: a function returning seconds since start. This exists so tests and simulations can pass a deterministic value instead of reading the real clock.

## Why this exists

`process.uptime()` returns a float in seconds. Turning that into something a human reads in a log line or a health endpoint is a small but recurring chore, and the naive `Math.floor(uptime / 60) + 'm'` loses information as soon as the duration crosses an hour or a day.

The trade-off here is that the formatter is deliberately non-localized and non-configurable beyond units, precision, and separator. It does not do "2 hours ago" relative formatting, and it does not guess at months or years, because those units have no fixed length. If you need calendar-aware output, this is the wrong tool.

## The awkward edge

Rounding is floor-based and precision counts components, not decimal places. A process at 59.9 seconds reports `59s`, never `60s`, and `precision: 2` on a duration of exactly one hour reports `1h`, not `1h 0m`. Zero-valued components are skipped, so the output can be shorter than `precision` suggests. The one exception is a total duration of zero, which reports `0` followed by the smallest requested unit.

## API

### `formatUptime(ms, options?)`

- `ms` — duration in milliseconds. Negative values are clamped to zero; fractional values are floored.
- `options.units` — array of `'d' | 'h' | 'm' | 's' | 'ms'`, or a comma-separated string. Defaults to all five in that order. Order is preserved, duplicates are removed.
- `options.precision` — positive integer, the maximum number of components to show. Defaults to the number of units.
- `options.separator` — string between components. Defaults to a single space.

Returns a string. Throws `RangeError` for unknown units or invalid precision, `TypeError` for a non-string separator or a `units` value that is neither an array nor a string.

### `formatUptimeFrom(options?)`

Same options as `formatUptime`, plus:

- `options.clock` — function returning seconds since process start. Defaults to `() => process.uptime()`.

Returns a string.

### `splitUptime(ms, options?)`

Lower-level helper. Returns an array of `{ unit, value }` objects in the requested unit order, with the same clamping and flooring rules as `formatUptime`.
