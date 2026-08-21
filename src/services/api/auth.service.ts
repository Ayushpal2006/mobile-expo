/**
 * Orion POS Mobile Expo - Authentication Service
 *
 * Interacts with backend REST authentication endpoints:
 * - POST /api/auth/login
 * - GET  /api/auth/me
 * - POST /api/auth/logout
 */

import { apiClient, ApiClientError } from './client';
import StorageService from '../storage/storage.service';
import { AuthSessionData, AuthUser, OrganizationContext, StoreContext } from '../../types';

export class AuthService {
  async login(email: string, pass: string): Promise<AuthSessionData> {
    const cleanEmail = email.trim().toLowerCase();

    const response = await apiClient.post<AuthSessionData>(
      '/api/auth/login',
      { email: cleanEmail, password: pass },
      { skipAuth: true }
    );

    if (!response.data || !response.data.token) {
      throw new ApiClientError('Invalid authentication response from backend server', 500);
    }

    const sessionData: AuthSessionData = response.data;

    // Attach token & tenant headers to API client
    apiClient.setAuthToken(sessionData.token);
    const storeId = sessionData.store?.id || sessionData.user?.store_id || null;
    const orgId = sessionData.organization?.id || sessionData.user?.organization_id || null;
    apiClient.setTenantContext(storeId, orgId);

    // Save token and context securely
    await StorageService.saveAuthToken(
      sessionData.token,
      JSON.stringify({
        user: sessionData.user,
        organization: sessionData.organization,
        store: sessionData.store,
        organizationStatus: sessionData.organizationStatus,
      })
    );

    return sessionData;
  }

  async getCurrentUser(): Promise<{
    user: AuthUser;
    organization: OrganizationContext | null;
    currentStore: StoreContext | null;
    organizationStatus?: string;
  }> {
    const response = await apiClient.get<{
      user: AuthUser;
      organization: OrganizationContext | null;
      currentStore: StoreContext | null;
      organizationStatus?: string;
    }>('/api/auth/me');

    return response.data;
  }

  async getStoredSession(): Promise<{ token: string; context: Partial<AuthSessionData> | null } | null> {
    const stored = await StorageService.getAuthToken();
    if (!stored || !stored.token) {
      return null;
    }

    apiClient.setAuthToken(stored.token);

    let context: Partial<AuthSessionData> | null = null;
    if (stored.contextJson) {
      try {
        context = JSON.parse(stored.contextJson);
        if (context) {
          const storeId = context.store?.id || context.user?.store_id || null;
          const orgId = context.organization?.id || context.user?.organization_id || null;
          apiClient.setTenantContext(storeId, orgId);
        }
      } catch {
        context = null;
      }
    }

    return { token: stored.token, context };
  }

  async logout(): Promise<void> {
    try {
      await apiClient.post('/api/auth/logout', {});
    } catch {
      // Continue clearing local storage even if network logout fails
    } finally {
      apiClient.setAuthToken(null);
      apiClient.setTenantContext(null, null);
      await StorageService.clearAuthToken();
    }
  }
}

export const authService = new AuthService();
export default authService;
