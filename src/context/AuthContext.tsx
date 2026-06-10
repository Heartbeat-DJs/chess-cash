/* ===================================================================
   ChessCash — Auth Context
   Client-side session state backed by the /api/auth endpoints.
   =================================================================== */

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export interface ClubUser {
  id: string;
  username: string;
  credits: number;
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}

interface AuthContextValue {
  user: ClubUser | null;
  /** True until the first /me check completes. */
  loading: boolean;
  login: (username: string, password: string) => Promise<ClubUser>;
  register: (username: string, password: string) => Promise<ClubUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => {
    throw new Error('AuthProvider missing');
  },
  register: async () => {
    throw new Error('AuthProvider missing');
  },
  logout: async () => {},
  refresh: async () => {},
});

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Request failed.');
  return data;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ClubUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const data = await postJson('/api/auth/login', { username, password });
    setUser(data.user);
    return data.user as ClubUser;
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const data = await postJson('/api/auth/register', { username, password });
    setUser(data.user);
    return data.user as ClubUser;
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
