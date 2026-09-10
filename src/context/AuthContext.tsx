/**
 * Orion POS Mobile Expo - Auth Context & Session Provider
 *
 * Current Product Rule: ONE ORGANIZATION = ONE STORE.
 * Multi-store switching is disabled for current version while preserving clean extension hooks.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authService } from '../services/api/auth.service';
import { apiClient } from '../services/api/client';
import { AuthUser, OrganizationContext, StoreContext } from '../types';

import { SyncEngine } from '../services/api/sync.service';
import { recordStartupPhase } from '../utils/startupDiagnostics';

export interface AuthContextType {
  user: AuthUser | null;
  organization: OrganizationContext | null;
  store: StoreContext | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginError: string | null;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [organization, setOrganization] = useState<OrganizationContext | null>(null);
  const [store, setStore] = useState<StoreContext | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setLoginError(null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      apiClient.clearTenantContext();
      apiClient.setAuthToken(null);
      setUser(null);
      setOrganization(null);
      setStore(null);
      setIsAuthenticated(false);
      setLoginError(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const meData = await authService.getCurrentUser();
      setUser(meData.user);
      setOrganization(meData.organization);
      const activeStore = meData.currentStore || (meData.organization ? { id: meData.organization.id, name: meData.organization.name } : null);
      setStore(activeStore);
      if (activeStore?.id && meData.organization?.id) {
        apiClient.setTenantContext(activeStore.id, meData.organization.id);
      } else if (activeStore?.id) {
        apiClient.setTenantContext(activeStore.id, null);
      }
      setIsAuthenticated(true);
      if (activeStore?.id) {
        SyncEngine.initialSync(activeStore.id, meData.organization?.id).catch(() => {});
      }
    } catch (err: any) {
      console.warn('[AuthProvider] Session refresh failed, logging out:', err.message);
      await logout();
    }
  }, [logout]);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    setLoginError(null);
    try {
      const session = await authService.login(email, pass);
      setUser(session.user);
      setOrganization(session.organization);
      const activeStore = session.store || (session.organization ? { id: session.organization.id, name: session.organization.name } : null);
      setStore(activeStore);
      if (session.token) {
        apiClient.setAuthToken(session.token);
      }
      if (activeStore?.id && session.organization?.id) {
        apiClient.setTenantContext(activeStore.id, session.organization.id);
      } else if (activeStore?.id) {
        apiClient.setTenantContext(activeStore.id, null);
      }
      setIsAuthenticated(true);
      if (activeStore?.id) {
        SyncEngine.initialSync(activeStore.id, session.organization?.id).catch(() => {});
      }
    } catch (err: any) {
      const msg = err.message || 'Login failed. Please check your credentials and server connection.';
      setLoginError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Attach 401 interception callback
    apiClient.setOnUnauthorized(() => {
      if (isMounted) {
        logout();
      }
    });

    const initAuth = async () => {
      console.log('[CHECKPOINT 5] Auth/bootstrap started: Restoring authentication session...');
      recordStartupPhase('P3', 'STARTED', 'Restoring session from SecureStore');
      try {
        const stored = await authService.getStoredSession();
        if (stored && stored.token) {
          apiClient.setAuthToken(stored.token);

          // Restore local cached user context immediately to prevent login flicker
          if (stored.context && stored.context.user) {
            setUser(stored.context.user);
            setOrganization(stored.context.organization || null);
            setStore(stored.context.store || null);
            if (stored.context.store?.id) {
              apiClient.setTenantContext(stored.context.store.id, stored.context.organization?.id || null);
            }
            setIsAuthenticated(true);
            console.log('[AuthContext] Cached offline session restored successfully.');
          }

          // Validate token with backend GET /api/auth/me (fast fail on offline)
          try {
            const meData = await authService.getCurrentUser();
            if (isMounted) {
              setUser(meData.user);
              setOrganization(meData.organization);
              const activeStore = meData.currentStore || (meData.organization ? { id: meData.organization.id, name: meData.organization.name } : null);
              setStore(activeStore);
              if (activeStore?.id) {
                apiClient.setTenantContext(activeStore.id, meData.organization?.id || null);
              }
              setIsAuthenticated(true);
              console.log('[AuthContext] Online token validation succeeded.');
              if (activeStore?.id) {
                SyncEngine.initialSync(activeStore.id).catch(() => {});
              }
            }
          } catch (meErr: any) {
            // Only trigger logout if server explicitly rejects token with 401
            if (meErr?.statusCode === 401) {
              console.warn('[AuthContext] Server rejected stored token with 401. Logging out.');
              if (isMounted) {
                await logout();
              }
            } else {
              // Network/Server offline error: maintain authenticated state if stored context exists
              console.log('[AuthContext] Backend unavailable on startup; continuing in offline mode with cached session.');
              if (isMounted && stored.context?.user) {
                setIsAuthenticated(true);
              }
            }
          }
        } else {
          console.log('[AuthContext] No stored session found; rendering login.');
        }
      } catch (err: any) {
        console.warn('[AuthContext] Session restore error:', err?.message || err);
        recordStartupPhase('P3', 'ERROR', err?.message || 'Session restore exception');
        if (isMounted) {
          try {
            await logout();
          } catch {}
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          console.log('[CHECKPOINT 6] Auth/bootstrap completed.');
          recordStartupPhase('P4', 'SUCCESS', 'Auth session initialization resolved');
        }
      }
    };

    initAuth();

    // Startup safety timeout: Guarantees loading state unlocks within 5 seconds under all conditions
    const safetyTimer = setTimeout(() => {
      if (isMounted && isLoading) {
        console.warn('[AuthContext] Safety timeout reached (5s); unlocking loading gate.');
        setIsLoading(false);
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        store,
        isAuthenticated,
        isLoading,
        loginError,
        login,
        logout,
        refreshUser,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
