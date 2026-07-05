import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { login, saveToken, loadToken, clearToken, AuthError } from '../api/client';
import { API } from '../api';
import type { Profile, AuthenticatedUser } from '../api/types';

interface AuthState {
  token: string | null;
  user: AuthenticatedUser | null;
  profile: Profile | null;
  currentYear: number | null;
  availableYears: number[];
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setCurrentYear: (year: number) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    user: null,
    profile: null,
    currentYear: null,
    availableYears: [],
    isLoading: true,
  });

  useEffect(() => {
    (async () => {
      try {
        const token = await loadToken();
        if (token) {
          const [user, profile, years] = await Promise.all([
            API.getAccount(token),
            API.getProfile(token),
            API.getYears(token),
          ]);
          setState({
            token,
            user,
            profile,
            availableYears: years,
            currentYear: years[years.length - 1] ?? null,
            isLoading: false,
          });
        } else {
          setState(s => ({ ...s, isLoading: false }));
        }
      } catch (e) {
        if (e instanceof AuthError) {
          await clearToken();
        }
        setState(s => ({ ...s, isLoading: false }));
      }
    })();
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const token = await login(username, password);
    await saveToken(token);
    const [user, profile, years] = await Promise.all([
      API.getAccount(token),
      API.getProfile(token),
      API.getYears(token),
    ]);
    setState({
      token,
      user,
      profile,
      availableYears: years,
      currentYear: years[years.length - 1] ?? null,
      isLoading: false,
    });
  }, []);

  const signOut = useCallback(async () => {
    await clearToken();
    setState({ token: null, user: null, profile: null, currentYear: null, availableYears: [], isLoading: false });
  }, []);

  const setCurrentYear = useCallback((year: number) => {
    setState(s => ({ ...s, currentYear: year }));
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!state.token) return;
    const profile = await API.getProfile(state.token);
    setState(s => ({ ...s, profile }));
  }, [state.token]);

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut, setCurrentYear, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
