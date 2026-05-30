/**
 * Idempotency key generation for offline queue and duplicate prevention.
 * Backend uses these to reject duplicate submissions.
 */

/**
 * Generate a unique idempotency key for an action.
 * Format: {actionType}-{userId}-{timestamp} or {actionType}-{context}-{timestamp}
 */
export function generateIdempotencyKey(
  actionType: string,
  userId?: string | null,
  context?: string
): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 11);
  if (userId) {
    return `${actionType}-${userId}-${ts}-${rand}`;
  }
  if (context) {
    return `${actionType}-${context}-${ts}-${rand}`;
  }
  return `${actionType}-${ts}-${rand}`;
}

/**
 * Generate idempotency key for punch-in (one per user per shift start).
 * Use: punch-in-{userId}-{date}-{shiftId} for same-day dedup.
 */
export function punchInIdempotencyKey(userId: string, shiftId?: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return shiftId ? `punch-in-${userId}-${date}-${shiftId}` : `punch-in-${userId}-${date}-${Date.now()}`;
}

/**
 * Generate idempotency key for punch-out.
 */
export function punchOutIdempotencyKey(userId: string): string {
  return `punch-out-${userId}-${Date.now()}`;
}

/**
 * Generate idempotency key for start-break.
 */
export function startBreakIdempotencyKey(userId: string): string {
  const date = new Date().toISOString();
  return `start-break-${userId}-${date.slice(0, 13)}`; // Per hour dedup
}

/**
 * Generate idempotency key for end-break.
 */
export function endBreakIdempotencyKey(userId: string): string {
  return `end-break-${userId}-${Date.now()}`;
}

/**
 * Generate idempotency key for withdrawal.
 */
export function withdrawalIdempotencyKey(userId: string, amount: number): string {
  return `withdraw-${userId}-${amount}-${Date.now()}`;
}

/**
 * Generate idempotency key for order picking actions.
 */
export function orderActionIdempotencyKey(
  actionType: "start-picking" | "complete-picking" | "update-status",
  orderId: string,
  userId?: string
): string {
  const uid = userId ?? "anon";
  return `${actionType}-${orderId}-${uid}-${Date.now()}`;
}
