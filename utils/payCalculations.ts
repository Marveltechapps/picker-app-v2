/**
 * Pay Calculation Utilities
 *
 * This module provides a single source of truth for all pay calculations.
 * All overtime (OT) calculations must use these functions to ensure consistency.
 * Config can be set from API (dashboard-managed) via setPayConfig().
 */

const DEFAULT_BASE_PAY = 100;
const DEFAULT_OT_MULTIPLIER = 1.25;

let configOverride: { basePayPerHour: number; overtimeMultiplier: number } | null = null;

/**
 * Set pay config from API (called when config is loaded).
 * Pass null to reset to defaults.
 */
export function setPayConfig(config: { basePayPerHour: number; overtimeMultiplier: number } | null): void {
  configOverride = config;
}

function getBasePay(): number {
  return configOverride?.basePayPerHour ?? DEFAULT_BASE_PAY;
}

function getOtMultiplier(): number {
  return configOverride?.overtimeMultiplier ?? DEFAULT_OT_MULTIPLIER;
}

/** @deprecated Use getBasePayPerHour() - kept for compatibility */
export const BASE_PAY_PER_HOUR = DEFAULT_BASE_PAY;

/** @deprecated Use getOvertimeMultiplier() - kept for compatibility */
export const OVERTIME_MULTIPLIER = DEFAULT_OT_MULTIPLIER;

/**
 * Calculate the overtime rate per hour
 * @returns Overtime rate per hour (base pay × multiplier)
 */
export function getOvertimeRatePerHour(): number {
  return getBasePay() * getOtMultiplier();
}

/**
 * Calculate regular pay for given hours
 * @param hours - Number of regular hours worked
 * @returns Regular pay amount (rounded to 2 decimal places)
 */
export function calculateRegularPay(hours: number): number {
  if (hours < 0) {
    console.warn('calculateRegularPay: hours cannot be negative, returning 0');
    return 0;
  }
  
  const pay = hours * getBasePay();
  return Math.round(pay * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate overtime pay for given overtime hours
 * @param overtimeHours - Number of overtime hours worked
 * @returns Overtime pay amount (rounded to 2 decimal places)
 */
export function calculateOvertimePay(overtimeHours: number): number {
  if (overtimeHours < 0) {
    console.warn('calculateOvertimePay: overtimeHours cannot be negative, returning 0');
    return 0;
  }
  
  if (overtimeHours === 0) {
    return 0;
  }
  
  const otRate = getOvertimeRatePerHour();
  const pay = overtimeHours * otRate;
  return Math.round(pay * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate total pay (regular + overtime)
 * @param regularHours - Number of regular hours worked
 * @param overtimeHours - Number of overtime hours worked (default: 0)
 * @returns Total pay amount (rounded to 2 decimal places)
 */
export function calculateTotalPay(regularHours: number, overtimeHours: number = 0): number {
  const regularPay = calculateRegularPay(regularHours);
  const otPay = calculateOvertimePay(overtimeHours);
  return Math.round((regularPay + otPay) * 100) / 100;
}

/**
 * Calculate base pay for a given number of hours
 * This is an alias for calculateRegularPay for clarity
 * @param hours - Number of hours
 * @returns Base pay amount
 */
export function calculateBasePay(hours: number): number {
  return calculateRegularPay(hours);
}

/**
 * Get base pay per hour (for display purposes)
 * @returns Base pay per hour
 */
export function getBasePayPerHour(): number {
  return getBasePay();
}

/**
 * Get overtime multiplier (for display purposes)
 * @returns Overtime multiplier (e.g., 1.25)
 */
export function getOvertimeMultiplier(): number {
  return getOtMultiplier();
}

/**
 * Validate pay calculation inputs
 * @param regularHours - Regular hours to validate
 * @param overtimeHours - Overtime hours to validate
 * @returns Object with validation result and error message if invalid
 */
export function validatePayInputs(
  regularHours: number,
  overtimeHours: number = 0
): { isValid: boolean; error?: string } {
  if (isNaN(regularHours) || regularHours < 0) {
    return { isValid: false, error: 'Regular hours must be a non-negative number' };
  }
  
  if (isNaN(overtimeHours) || overtimeHours < 0) {
    return { isValid: false, error: 'Overtime hours must be a non-negative number' };
  }
  
  if (!isFinite(regularHours) || !isFinite(overtimeHours)) {
    return { isValid: false, error: 'Hours must be finite numbers' };
  }
  
  return { isValid: true };
}

/**
 * Format pay amount for display
 * @param amount - Pay amount to format
 * @returns Formatted string (e.g., "₹1,250.50")
 */
export function formatPayAmount(amount: number): string {
  if (isNaN(amount) || !isFinite(amount)) {
    return '₹0';
  }
  
  // Round to nearest integer for display
  const rounded = Math.round(amount);
  return `₹${rounded.toLocaleString('en-IN')}`;
}

/**
 * Calculate pay breakdown for a work period
 * @param regularHours - Regular hours worked
 * @param overtimeHours - Overtime hours worked
 * @returns Object with detailed pay breakdown
 */
export interface PayBreakdown {
  regularHours: number;
  regularPay: number;
  overtimeHours: number;
  overtimePay: number;
  totalPay: number;
  basePayPerHour: number;
  overtimeRatePerHour: number;
}

export function calculatePayBreakdown(
  regularHours: number,
  overtimeHours: number = 0
): PayBreakdown {
  const validation = validatePayInputs(regularHours, overtimeHours);
  if (!validation.isValid) {
    console.warn(`calculatePayBreakdown: Invalid inputs - ${validation.error}`);
    return {
      regularHours: 0,
      regularPay: 0,
      overtimeHours: 0,
      overtimePay: 0,
      totalPay: 0,
      basePayPerHour: getBasePay(),
      overtimeRatePerHour: getOvertimeRatePerHour(),
    };
  }
  
  const regularPay = calculateRegularPay(regularHours);
  const otPay = calculateOvertimePay(overtimeHours);
  const totalPay = Math.round((regularPay + otPay) * 100) / 100;
  
  return {
    regularHours,
    regularPay,
    overtimeHours,
    overtimePay: otPay,
    totalPay,
    basePayPerHour: getBasePay(),
    overtimeRatePerHour: getOvertimeRatePerHour(),
  };
}
