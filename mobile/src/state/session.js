import React, { createContext, useContext, useMemo, useState } from 'react';
import { api } from '../api/client';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);

  const value = useMemo(() => ({
    token,
    user,
    async register(email, password, displayName, onboardingPayload) {
      const out = await api.register({ email, password, displayName });
      setToken(out.token);

      try {
        if (onboardingPayload) {
          const profile = await api.completeOnboarding(out.token, onboardingPayload);
          setUser(profile);
        } else {
          setUser(out.user);
        }
      } catch {
        setUser(out.user);
      }
    },
    async login(email, password) {
      const out = await api.login({ email, password });
      setToken(out.token);
      setUser(out.user);
    },
    async refreshProfile() {
      if (!token) return null;
      const profile = await api.profile(token);
      setUser(profile);
      return profile;
    },
    setUser,
    logout() {
      setToken('');
      setUser(null);
    },
  }), [token, user, setUser]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession must be used in SessionProvider');
  }
  return value;
}
