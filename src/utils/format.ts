/**
 * Orion POS / Apka Bill - Centralized Indian Number & Currency Formatting Utility
 *
 * Ensures 100% consistent formatting across all screens:
 * - Indian number system grouping: ₹1,200, ₹12,000, ₹1,20,000, ₹12,00,000, ₹1,00,00,000
 * - Handles negative values: -₹1,200
 * - Handles zero values: ₹0
 * - Guards against NaN, undefined, null, empty strings
 * - Prevents double ₹ symbol formatting
 */

export interface FormatOptions {
  hideSymbol?: boolean;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}

/**
 * Format a number or numeric string into Indian Rupee presentation (e.g. ₹12,00,000)
 */
export function formatINR(value: number | string | null | undefined, options?: FormatOptions): string {
  if (value === null || value === undefined || value === '') {
    return options?.hideSymbol ? '0' : '₹0';
  }

  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
  if (isNaN(num)) {
    return options?.hideSymbol ? '0' : '₹0';
  }

  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const decimals = options?.decimals !== undefined ? options?.decimals : 0;

  // Split integer and decimal parts
  const parts = absNum.toFixed(decimals).split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1] ? `.${parts[1]}` : '';

  // Apply Indian grouping: last 3 digits, then groups of 2 digits
  let formattedInteger: string;
  if (integerPart.length <= 3) {
    formattedInteger = integerPart;
  } else {
    const lastThree = integerPart.substring(integerPart.length - 3);
    const otherNumbers = integerPart.substring(0, integerPart.length - 3);
    const groupedOther = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    formattedInteger = `${groupedOther},${lastThree}`;
  }

  const result = `${formattedInteger}${decimalPart}`;
  const prefix = options?.prefix || '';
  const suffix = options?.suffix || '';

  if (options?.hideSymbol) {
    return `${isNegative ? '-' : ''}${prefix}${result}${suffix}`;
  }

  return `${isNegative ? '-' : ''}₹${prefix}${result}${suffix}`;
}

/**
 * Primary INR currency formatter shorthand: inr(1200000) => "₹12,00,000"
 */
export const inr = (value: number | string | null | undefined, decimals?: number): string =>
  formatINR(value, { decimals });

/**
 * Number formatter without currency symbol: formatNumber(1200000) => "12,00,000"
 */
export const formatNumber = (value: number | string | null | undefined, decimals?: number): string =>
  formatINR(value, { hideSymbol: true, decimals });

/**
 * Number parser that safely converts text input to number
 */
export const parseNumber = (value: string | number | null | undefined, fallback = 0): number => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number') return isNaN(value) ? fallback : value;
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? fallback : parsed;
};

export default {
  formatINR,
  inr,
  formatNumber,
  parseNumber,
};
