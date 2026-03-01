import React, { createContext, useContext, useMemo, useState } from 'react';
import { api } from '../api/client';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [pendingVerification, setPendingVerification] = useState(null);

  const value = useMemo(() => ({
    token,
    user,
    pendingVerification,
    async register(email, password, displayName, onboardingPayload) {
      const out = await api.register({ email, password, displayName });

      if (out.requiresEmailVerification) {
        setPendingVerification({
          email: email.trim(),
          onboardingPayload: onboardingPayload ?? null,
          verificationToken: out.verificationToken ?? '',
          verificationUrl: out.verificationUrl ?? '',
        });
        setToken('');
        setUser(out.user ?? null);
        return out;
      }

      if (out.token) {
        setToken(out.token);
      }
      setUser(out.user ?? null);
      return out;
    },
    async verifyEmail(verificationToken) {
      if (!verificationToken) {
        throw new Error('Code de verification requis');
      }

      const out = await api.verifyEmail(verificationToken.trim());
      setToken(out.token);

      try {
        if (pendingVerification?.onboardingPayload) {
          const profile = await api.completeOnboarding(out.token, pendingVerification.onboardingPayload);
          setUser(profile);
        } else {
          setUser(out.user);
        }
      } finally {
        setPendingVerification(null);
      }

      return out;
    },
    async login(email, password) {
      const out = await api.login({ email, password });
      setToken(out.token);
      setUser(out.user);
      setPendingVerification(null);
    },
    async refreshProfile() {
      if (!token) return null;
      const profile = await api.profile(token);
      setUser(profile);
      return profile;
    },
    async updateSettings(settingsPayload) {
      if (!token) {
        throw new Error('Session invalide');
      }
      const profile = await api.updateSettings(token, settingsPayload);
      setUser(profile);
      return profile;
    },
    setUser,
    logout() {
      setToken('');
      setUser(null);
      setPendingVerification(null);
    },
  }), [token, user, pendingVerification, setUser]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession must be used in SessionProvider');
  }
  return value;
}
