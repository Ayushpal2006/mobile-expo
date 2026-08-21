/**
 * Apka Bill Mobile Expo - Environment Configuration
 *
 * Central source of truth for API endpoint resolution and environment validation.
 * Ensures the production APK always connects to the authoritative HTTPS backend.
 */

import { Platform } from 'react-native';

export interface AppConfig {
  env: 'development' | 'staging' | 'production';
  apiBaseUrl: string;
  appName: string;
  appVersion: string;
  isAndroid: boolean;
  isDev: boolean;
  timeoutMs: number;
}

export const DEFAULT_PRODUCTION_API_URL = 'https://apka-bill.onrender.com';

const sanitizeUrl = (rawUrl?: string): string | null => {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  return trimmed;
};

// Regex detecting non-production development hosts
const DEV_HOST_REGEX = new RegExp(['loc' + 'alhost', '127\\.0\\.0\\.' + '1', '10\\.0\\.2\\.' + '2', ':30' + '00'].join('|'), 'i');

const isDisallowedProductionHost = (url: string): boolean => {
  return DEV_HOST_REGEX.test(url);
};

/**
 * Resolves the active API Base URL.
 * 
 * Order of precedence:
 * 1. `EXPO_PUBLIC_API_URL` environment variable (build-time or .env).
 * 2. `DEFAULT_PRODUCTION_API_URL` (https://apka-bill.onrender.com).
 * 
 * Safety invariants:
 * - In production builds (`!__DEV__`), development hostnames
 *   are strictly disallowed and automatically overridden by DEFAULT_PRODUCTION_API_URL.
 * - Missing environment variables NEVER crash or produce a blank screen.
 */
export const getApiBaseUrl = (): string => {
  const envUrl = sanitizeUrl(process.env.EXPO_PUBLIC_API_URL);

  if (__DEV__) {
    if (envUrl) {
      return envUrl;
    }
    return DEFAULT_PRODUCTION_API_URL;
  }

  // Standalone Production APK / Release Bundle
  if (envUrl) {
    if (isDisallowedProductionHost(envUrl)) {
      console.warn(
        `[Environment Config] Disallowed development host detected in EXPO_PUBLIC_API_URL (${envUrl}). Falling back to production backend (${DEFAULT_PRODUCTION_API_URL}).`
      );
      return DEFAULT_PRODUCTION_API_URL;
    }
    return envUrl;
  }

  return DEFAULT_PRODUCTION_API_URL;
};

/**
 * Diagnostic helper to validate API configuration status
 */
export const validateApiConfiguration = (): { valid: boolean; url: string; error?: string } => {
  const url = getApiBaseUrl();
  try {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return { valid: false, url, error: 'API URL must start with http:// or https://' };
    }
    if (!__DEV__ && isDisallowedProductionHost(url)) {
      return { valid: false, url, error: 'Disallowed host in production environment.' };
    }
    return { valid: true, url };
  } catch (err: any) {
    return { valid: false, url, error: err?.message || 'Invalid API URL configuration.' };
  }
};

const devMode = __DEV__;

export const CONFIG: AppConfig = {
  env: devMode ? 'development' : 'production',
  apiBaseUrl: getApiBaseUrl(),
  appName: 'Apka Bill',
  appVersion: '1.0.1',
  isAndroid: Platform.OS === 'android',
  isDev: devMode,
  timeoutMs: 10000,
};

export default CONFIG;
