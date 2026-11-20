/**
 * Public entry point for process-uptime-tools.
 *
 * Re-exports the formatter from core so consumers have a single import
 * surface. Keeping the barrel file tiny makes the public API obvious.
 */

export { formatUptime, formatUptimeFrom } from './core.js';
