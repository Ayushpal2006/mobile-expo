/**
 * Orion POS Mobile Expo - Production-Hardened Centralized API Client
 *
 * Features:
 * - Exponential backoff retry mechanism for transient network & server failures
 * - Automatic Authorization: Bearer <token> & Tenant Header Injection (X-Store-Id, X-Organization-Id)
 * - Idempotency support via X-Offline-Id header
 * - Timeout handling via AbortController
 * - Error categorization & Unauthorized (401) interception
 */

import { CONFIG } from '../../config/env';
import { ApiResponse, ApiRequestOptions, HealthCheckResult } from '../../types';
import logger from '../../utils/logger';

export class ApiClientError extends Error {
  statusCode: number;
  data?: any;

  constructor(message: string, statusCode: number = 0, data?: any) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

export class ApiClient {
  private baseUrl: string;
  private defaultTimeout: number;
  private authToken: string | null = null;
  private storeId: number | null = null;
  private organizationId: number | null = null;
  private onUnauthorizedCallback: (() => void) | null = null;

  constructor(baseUrl: string = CONFIG.apiBaseUrl, timeoutMs: number = CONFIG.timeoutMs) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.defaultTimeout = timeoutMs;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  public setAuthToken(token: string | null): void {
    this.authToken = token;
  }

  public getAuthToken(): string | null {
    return this.authToken;
  }

  public setTenantContext(storeId: number | null, organizationId: number | null): void {
    this.storeId = storeId;
    this.organizationId = organizationId;
  }

  public clearTenantContext(): void {
    this.storeId = null;
    this.organizationId = null;
  }

  public setOnUnauthorized(callback: (() => void) | null): void {
    this.onUnauthorizedCallback = callback;
  }

  /**
   * Internal request executor with retry logic for transient errors
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit & ApiRequestOptions = {},
    retries = 2
  ): Promise<ApiResponse<T>> {
    const { timeoutMs = this.defaultTimeout, params, headers = {}, skipAuth = false, ...fetchOptions } = options;

    let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          searchParams.append(key, String(val));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        cleanEndpoint += (cleanEndpoint.includes('?') ? '&' : '?') + queryString;
      }
    }

    const fullUrl = `${this.baseUrl}${cleanEndpoint}`;

    // Login and auth validation calls should NEVER retry blindly on startup
    const isAuthCall = cleanEndpoint.includes('/auth/login') || cleanEndpoint.includes('/auth/me') || skipAuth;
    const effectiveRetries = isAuthCall ? 0 : retries;

    const requestHeaders: Record<string, string> = {
      Accept: 'application/json',
      'X-Client-Platform': CONFIG.isAndroid ? 'android' : 'ios',
      'X-Client-Version': CONFIG.appVersion,
    };

    // Only set Content-Type to JSON if body is not FormData
    if (!(fetchOptions.body instanceof FormData)) {
      requestHeaders['Content-Type'] = 'application/json';
    }

    if (this.storeId) {
      requestHeaders['X-Store-Id'] = String(this.storeId);
    }
    if (this.organizationId) {
      requestHeaders['X-Organization-Id'] = String(this.organizationId);
    }

    if (headers && typeof headers === 'object' && !Array.isArray(headers)) {
      Object.assign(requestHeaders, headers);
    }

    if (this.authToken && !skipAuth && !requestHeaders.Authorization) {
      requestHeaders.Authorization = `Bearer ${this.authToken}`;
    }

    let attempt = 0;
    let lastError: any = null;

    while (attempt <= effectiveRetries) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const method = fetchOptions.method || 'GET';
        logger.info(`[ApiClient] ${method} ${cleanEndpoint} (Attempt ${attempt + 1}/${effectiveRetries + 1}) Target: ${this.baseUrl}`);

        const response = await fetch(fullUrl, {
          ...fetchOptions,
          headers: requestHeaders,
          signal: controller.signal,
        });

        clearTimeout(timer);

        let responseData: any = null;
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          responseData = await response.json();
        } else {
          responseData = await response.text();
        }

        logger.info(`[ApiClient] ${method} ${cleanEndpoint} -> HTTP ${response.status} ${response.statusText} (${contentType})`);

        if (!response.ok) {
          let errorMessage: string;

          if (response.status === 401) {
            if (this.onUnauthorizedCallback && !skipAuth) {
              this.onUnauthorizedCallback();
            }
            errorMessage =
              (typeof responseData === 'object' && (responseData?.error || responseData?.message)) ||
              'Invalid email or password.';
            throw new ApiClientError(errorMessage, 401, responseData);
          }

          if (response.status === 404) {
            const rawMsg = typeof responseData === 'object' ? (responseData?.message || responseData?.error) : String(responseData);
            errorMessage =
              rawMsg === 'Application not found'
                ? 'Backend server endpoint not found (HTTP 404). Please verify backend server deployment.'
                : (rawMsg || 'Requested resource not found on server (HTTP 404).');
            throw new ApiClientError(errorMessage, 404, responseData);
          }

          if (response.status === 403) {
            errorMessage =
              (typeof responseData === 'object' && (responseData?.error || responseData?.message)) ||
              'Your account has been disabled. Please contact your admin.';
            throw new ApiClientError(errorMessage, 403, responseData);
          }

          errorMessage =
            (typeof responseData === 'object' && (responseData?.error || responseData?.message)) ||
            (response.status >= 500 ? 'Server error. Please try again later.' : `HTTP ${response.status}: ${response.statusText}`);

          // Retry ONLY on transient 5xx Server Errors, 429 Rate Limit, or 408 Timeout for non-auth requests
          if ((response.status >= 500 || response.status === 429 || response.status === 408) && effectiveRetries > 0) {
            if (attempt < effectiveRetries) {
              attempt++;
              const delay = Math.pow(2, attempt) * 500;
              await new Promise((r) => setTimeout(r, delay));
              continue;
            }
          }

          throw new ApiClientError(errorMessage, response.status, responseData);
        }

        return {
          success: true,
          data: (responseData && typeof responseData === 'object' && 'data' in responseData)
            ? responseData.data
            : responseData,
          message: responseData?.message,
          statusCode: response.status,
        };
      } catch (err: any) {
        clearTimeout(timer);
        lastError = err;

        if (err instanceof ApiClientError && err.statusCode !== 0 && err.statusCode < 500) {
          throw err;
        }

        // Retry transient network failures ONLY if retries allowed
        if (effectiveRetries > 0 && attempt < effectiveRetries) {
          attempt++;
          const delay = Math.pow(2, attempt) * 500;
          await new Promise((r) => setTimeout(r, delay));
        } else {
          break;
        }
      }
    }

    if (lastError instanceof ApiClientError) {
      throw lastError;
    }

    const netMsg = lastError?.name === 'AbortError'
      ? 'Server took too long to respond. Please try again.'
      : (lastError?.message || 'Unable to connect to the server. Check your internet connection.');

    throw new ApiClientError(netMsg, 0, lastError);
  }

  public async get<T = any>(endpoint: string, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET', ...options });
  }

  public async post<T = any>(endpoint: string, body?: any, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    });
  }

  public async put<T = any>(endpoint: string, body?: any, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    });
  }

  public async delete<T = any>(endpoint: string, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE', ...options });
  }

  public async uploadFile<T = any>(endpoint: string, formData: FormData, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: formData,
      ...options,
    });
  }

  public async testConnection(healthEndpoint: string = '/api/health'): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const targetUrl = `${this.baseUrl}${healthEndpoint.startsWith('/') ? healthEndpoint : `/${healthEndpoint}`}`;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(targetUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json, text/plain, */*' },
      });

      clearTimeout(timer);
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText || (response.ok ? 'OK' : 'Error'),
        responseTimeMs: Date.now() - startTime,
        url: targetUrl,
      };
    } catch (err: any) {
      return {
        ok: false,
        status: 0,
        statusText: err.name === 'AbortError' ? 'Timeout' : 'Network Error',
        responseTimeMs: Date.now() - startTime,
        error: err.message || 'Unable to reach backend',
        url: targetUrl,
      };
    }
  }
}

export const apiClient = new ApiClient();

/**
 * Universal API payload normalizer:
 * Extracts inner payload regardless of unwrapping depth (ApiResponse.data vs raw vs nested data.data)
 */
export function extractApiPayload<T = any>(res: any): T {
  if (res === null || res === undefined) {
    return null as any;
  }
  if (Array.isArray(res)) {
    return res as unknown as T;
  }
  if (typeof res === 'object') {
    if ('data' in res) {
      const inner = res.data;
      if (inner !== null && typeof inner === 'object' && 'data' in inner && !Array.isArray(inner)) {
        return inner.data as T;
      }
      return inner as T;
    }
  }
  return res as T;
}

export default apiClient;
