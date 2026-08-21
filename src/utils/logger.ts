/**
 * Orion POS Mobile Expo - Safe Logger Utility
 *
 * Sanitizes passwords, JWT tokens, and sensitive payment data before logging to console.
 */

const SENSITIVE_KEYS = ['password', 'token', 'authorization', 'secret', 'creditcard', 'cvv'];

function sanitize(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    if (obj.length > 200) return `${obj.substring(0, 100)}...[TRUNCATED]`;
    return obj;
  }
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitize);
  }

  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    const isSensitive = SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s));
    clean[key] = isSensitive ? '[REDACTED]' : sanitize(val);
  }
  return clean;
}

export const logger = {
  info: (message: string, ...meta: any[]) => {
    if (__DEV__) {
      console.log(`[INFO] ${message}`, ...meta.map(sanitize));
    }
  },
  warn: (message: string, ...meta: any[]) => {
    console.warn(`[WARN] ${message}`, ...meta.map(sanitize));
  },
  error: (message: string, ...meta: any[]) => {
    console.error(`[ERROR] ${message}`, ...meta.map(sanitize));
  },
};

export default logger;
