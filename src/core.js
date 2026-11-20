/**
 * Core uptime formatting logic.
 *
 * Design decisions:
 *
 * 1. Units are fixed and explicit. We support the units that map cleanly
 *    onto a human-readable duration: days, hours, minutes, seconds, and
 *    milliseconds. We do not support weeks, months, or years because their
 *    lengths are ambiguous (a month is not a fixed number of seconds).
 *
 * 2. Precision is the number of unit components shown, not decimal places.
 *    `formatUptime(90061, { precision: 2 })` yields "1d 1h" rather than
 *    "1.00d". This matches how uptime is usually read: you want the largest
 *    units first and you stop after N of them.
 *
 * 3. Rounding is floor-based. We never round up a component, because that
 *    would make the displayed duration exceed the real elapsed time. A
 *    process that has been up for 59.9 seconds reports "59s", not "60s".
 *    This is the safer choice for monitoring: under-reporting is less
 *    surprising than over-reporting.
 *
 * 4. Sub-millisecond input is truncated. Node's `process.uptime()` returns
 *    seconds as a float, so we convert to milliseconds and truncate. A
 *    value of 0.0009 seconds becomes 0 ms.
 *
 * 5. Negative input is clamped to 0. Uptime cannot be negative in practice,
 *    but a fake clock in tests or a misconfigured caller might pass one.
 *    Clamping keeps the output sane instead of producing "-1s".
 */

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

const UNIT_ORDER = ['d', 'h', 'm', 's', 'ms'];

const UNIT_MS = {
  d: MS_PER_DAY,
  h: MS_PER_HOUR,
  m: MS_PER_MINUTE,
  s: MS_PER_SECOND,
  ms: 1,
};

/**
 * Normalize the options object into a stable shape.
 *
 * We accept `units` as either an array or a comma-separated string because
 * the most common call site is a config file or CLI flag. Accepting both
 * avoids a parse step in the caller.
 */
function normalizeOptions(options) {
  const opts = options || {};

  let units = UNIT_ORDER;
  if (opts.units !== undefined) {
    if (typeof opts.units === 'string') {
      units = opts.units.split(',').map((u) => u.trim()).filter(Boolean);
    } else if (Array.isArray(opts.units)) {
      units = opts.units.slice();
    } else {
      throw new TypeError('units must be an array or a comma-separated string');
    }
  }

  for (const unit of units) {
    if (!Object.prototype.hasOwnProperty.call(UNIT_MS, unit)) {
      throw new RangeError(`unknown unit: ${unit}`);
    }
  }

  // Preserve the caller's order but remove duplicates. Duplicates would
  // otherwise produce repeated components like "1s 1s".
  const seen = new Set();
  const uniqueUnits = [];
  for (const unit of units) {
    if (!seen.has(unit)) {
      seen.add(unit);
      uniqueUnits.push(unit);
    }
  }

  let precision = opts.precision;
  if (precision === undefined) {
    precision = uniqueUnits.length;
  }
  if (!Number.isInteger(precision) || precision < 1) {
    throw new RangeError('precision must be a positive integer');
  }

  let separator = opts.separator;
  if (separator === undefined) {
    separator = ' ';
  }
  if (typeof separator !== 'string') {
    throw new TypeError('separator must be a string');
  }

  return { units: uniqueUnits, precision, separator };
}

/**
 * Break a millisecond count into unit components.
 *
 * Exported for testing and for callers who want the raw numbers rather than
 * a formatted string. The return value is an array of `{ unit, value }`
 * objects in the order the units were requested.
 */
export function splitUptime(ms, options) {
  const { units } = normalizeOptions(options);

  let remaining = Math.floor(ms);
  if (!Number.isFinite(remaining) || remaining < 0) {
    remaining = 0;
  }

  const parts = [];
  for (const unit of units) {
    const size = UNIT_MS[unit];
    const value = Math.floor(remaining / size);
    remaining -= value * size;
    parts.push({ unit, value });
  }

  return parts;
}

/**
 * Format a millisecond duration as a human-readable string.
 *
 * @param {number} ms - duration in milliseconds
 * @param {object} [options]
 * @param {string[]|string} [options.units] - units to consider, in order
 * @param {number} [options.precision] - number of non-zero components to show
 * @param {string} [options.separator] - string between components
 * @returns {string}
 */
export function formatUptime(ms, options) {
  const { units, precision, separator } = normalizeOptions(options);
  const parts = splitUptime(ms, { units });

  const shown = [];
  for (const part of parts) {
    if (part.value > 0) {
      shown.push(`${part.value}${part.unit}`);
      if (shown.length === precision) {
        break;
      }
    }
  }

  // Zero duration is a real case: a freshly started process can report 0.
  // We still want a non-empty string, and the smallest requested unit is
  // the most honest answer.
  if (shown.length === 0) {
    const smallest = units[units.length - 1];
    return `0${smallest}`;
  }

  return shown.join(separator);
}

/**
 * Convenience wrapper that reads `process.uptime()` for you.
 *
 * The clock is injectable so tests never depend on wall-clock time. In
 * production you call this with no arguments.
 *
 * @param {object} [options]
 * @param {() => number} [options.clock] - returns seconds since start
 * @returns {string}
 */
export function formatUptimeFrom(options) {
  const opts = options || {};
  const clock = opts.clock || (() => process.uptime());
  const seconds = clock();
  const ms = Math.floor(seconds * MS_PER_SECOND);

  const { clock: _ignored, ...formatOptions } = opts;
  return formatUptime(ms, formatOptions);
}
