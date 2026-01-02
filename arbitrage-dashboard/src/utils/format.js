/**
 * Formatting utilities for display
 */

/**
 * Format price as cents (e.g., 0.523 -> "52.3¢")
 * @param {number} p - Price between 0 and 1
 * @returns {string} Formatted price
 */
export function formatPrice(p) {
  if (p === null || p === undefined || isNaN(p)) return '—';
  return `${(p * 100).toFixed(1)}¢`;
}

/**
 * Format percentage with sign (e.g., 0.023 -> "+2.3%")
 * @param {number} p - Percentage in decimal form
 * @param {boolean} showSign - Whether to show + for positive
 * @returns {string} Formatted percentage
 */
export function formatPct(p, showSign = true) {
  if (p === null || p === undefined || isNaN(p)) return '—';
  const sign = showSign && p > 0 ? '+' : '';
  return `${sign}${(p * 100).toFixed(2)}%`;
}

/**
 * Format depth/volume (e.g., 3200 -> "3.2kU")
 * @param {number} d - Depth in USD
 * @returns {string} Formatted depth
 */
export function formatDepth(d) {
  if (d === null || d === undefined || isNaN(d)) return '—';
  if (d >= 1000000) {
    return `${(d / 1000000).toFixed(1)}MU`;
  }
  if (d >= 1000) {
    return `${(d / 1000).toFixed(1)}kU`;
  }
  return `${d.toFixed(0)}U`;
}

/**
 * Format timestamp as time (e.g., "10:30:15")
 * @param {Date|number} date - Date object or timestamp
 * @returns {string} Formatted time
 */
export function formatTime(date) {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Format date and time
 * @param {Date|number} date - Date object or timestamp
 * @returns {string} Formatted datetime
 */
export function formatDateTime(date) {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleString('en-US', {
    hour12: false,
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Get CSS class for profit/loss coloring
 * @param {number} value - Numeric value
 * @returns {string} Tailwind CSS class
 */
export function getProfitClass(value) {
  if (value > 0) return 'text-green-600';
  if (value < 0) return 'text-red-600';
  return 'text-slate-500';
}

/**
 * Get signal badge class
 * @param {string} signal - 'HOT', 'GO', or 'NONE'
 * @returns {string} CSS classes
 */
export function getSignalClass(signal) {
  switch (signal) {
    case 'HOT':
      return 'bg-gradient-to-r from-orange-500 to-red-500 text-white px-2 py-0.5 rounded text-xs font-bold signal-hot';
    case 'GO':
      return 'border border-green-500 text-green-600 px-2 py-0.5 rounded text-xs font-bold';
    default:
      return 'text-slate-400 text-xs';
  }
}

/**
 * Get type badge class
 * @param {string} type - Market type
 * @returns {string} CSS classes
 */
export function getTypeBadgeClass(type) {
  const baseClass = 'px-2 py-0.5 rounded text-xs font-medium';
  switch (type?.toUpperCase()) {
    case 'LOL':
      return `${baseClass} badge-lol`;
    case 'AI':
      return `${baseClass} badge-ai`;
    case 'POLITICS':
      return `${baseClass} badge-politics`;
    case 'CRYPTO':
      return `${baseClass} badge-crypto`;
    default:
      return `${baseClass} badge-other`;
  }
}
