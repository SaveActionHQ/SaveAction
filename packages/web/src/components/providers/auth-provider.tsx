'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api, User, ApiClientError } from '@/lib/api';

// Auth context state
interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// Auth context actions
interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

// Combined context type
type AuthContextType = AuthState & AuthActions;

// Create context
const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

// Provider props
interface AuthProviderProps {
  children: React.ReactNode;
}

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password'];

// Auth routes where logged-in users should be redirected to dashboard
const AUTH_ROUTES = ['/login', '/register'];

/**
 * Auth Provider Component
 *
 * Manages authentication state and provides auth methods to children.
 * Automatically redirects based on auth status.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = React.useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Initialize auth state on mount
  React.useEffect(() => {
    const initAuth = async () => {
      // Check if we have a token
      if (api.isAuthenticated()) {
        try {
          const user = await api.getCurrentUser();
          setState({
            user,
            isLoading: false,
            isAuthenticated: true,
          });
        } catch {
          // Token is invalid, clear it
          api.setAccessToken(null);
          setState({
            user: null,
            isLoading: false,
            isAuthenticated: false,
          });
        }
      } else {
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    };

    initAuth();
  }, []);

  // Handle route protection
  React.useEffect(() => {
    if (state.isLoading) return;

    const isPublicRoute = PUBLIC_ROUTES.some(
      (route) => pathname === route || pathname?.startsWith(`${route}/`)
    );

    const isAuthRoute = AUTH_ROUTES.some(
      (route) => pathname === route || pathname?.startsWith(`${route}/`)
    );

    if (!state.isAuthenticated && !isPublicRoute) {
      // Redirect to login if not authenticated and on protected route
      router.replace(`/login?redirect=${encodeURIComponent(pathname || '/dashboard')}`);
    } else if (state.isAuthenticated && isAuthRoute) {
      // Redirect to dashboard if authenticated and on login/register page
      router.replace('/dashboard');
    }
  }, [state.isAuthenticated, state.isLoading, pathname, router]);

  // Login action
  const login = React.useCallback(async (email: string, password: string) => {
    try {
      const response = await api.login({ email, password });
      setState({
        user: response.user,
        isLoading: false,
        isAuthenticated: true,
      });
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw error;
      }
      throw new ApiClientError({
        code: 'LOGIN_FAILED',
        message: 'Failed to login. Please try again.',
      });
    }
  }, []);

  // Register action
  const register = React.useCallback(
    async (name: string, email: string, password: string) => {
      try {
        const response = await api.register({ name, email, password });
        setState({
          user: response.user,
          isLoading: false,
          isAuthenticated: true,
        });
      } catch (error) {
        if (error instanceof ApiClientError) {
          throw error;
        }
        throw new ApiClientError({
          code: 'REGISTER_FAILED',
          message: 'Failed to register. Please try again.',
        });
      }
    },
    []
  );

  // Logout action
  const logout = React.useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Ignore logout errors, still clear local state
    } finally {
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
      router.push('/login');
    }
  }, [router]);

  // Refresh user data
  const refreshUser = React.useCallback(async () => {
    if (!api.isAuthenticated()) return;

    try {
      const user = await api.getCurrentUser();
      setState((prev) => ({
        ...prev,
        user,
      }));
    } catch {
      // Token might be invalid, trigger logout
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }, []);

  const value = React.useMemo(
    () => ({
      ...state,
      login,
      register,
      logout,
      refreshUser,
    }),
    [state, login, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context
 *
 * @throws Error if used outside AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Hook to get the current user
 * Returns null if not authenticated
 */
export function useUser(): User | null {
  const { user } = useAuth();
  return user;
}

/**
 * Hook to check if user is authenticated
 */
export function useIsAuthenticated(): boolean {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
}
