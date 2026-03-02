import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, api } from '../api/client';

const SessionContext = createContext(null);
const SESSION_STORAGE_KEY = 'padely.session.v1';

export function SessionProvider({ children }) {
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [pendingVerification, setPendingVerification] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    async function hydrate() {
      try {
        const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
        if (!raw) {
          setHydrated(true);
          return;
        }
        const parsed = JSON.parse(raw);
        setToken(parsed?.token ?? '');
        setUser(parsed?.user ?? null);
        setPendingVerification(parsed?.pendingVerification ?? null);
      } catch {
        await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
      } finally {
        setHydrated(true);
      }
    }

    hydrate().catch(() => {
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const payload = JSON.stringify({ token, user, pendingVerification });
    AsyncStorage.setItem(SESSION_STORAGE_KEY, payload).catch(() => {});
  }, [token, user, pendingVerification, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (!token && user) {
      setUser(null);
    }
  }, [hydrated, token, user]);

  function isUnauthorizedError(error) {
    if (error instanceof ApiError && error.status === 401) {
      return true;
    }
    const msg = String(error?.message ?? '').toLowerCase();
    return msg.includes('authentication required')
      || msg.includes('unauthorized')
      || msg.includes('missing auth token')
      || msg.includes('invalid token');
  }

  function hardLogout() {
    setToken('');
    setUser(null);
    setPendingVerification(null);
    AsyncStorage.removeItem(SESSION_STORAGE_KEY).catch(() => {});
  }

  const value = useMemo(() => ({
    token,
    user,
    pendingVerification,
    hydrated,
    async register(email, password, displayName, onboardingPayload) {
      const out = await api.register({ email, password, displayName });

      if (out.requiresEmailVerification) {
        setPendingVerification({
          email: email.trim(),
          onboardingPayload: onboardingPayload ?? null,
          maskedEmail: out.maskedEmail ?? email.trim(),
          devCode: out.devCode ?? '',
          expiresInMinutes: out.expiresInMinutes ?? 15,
          verificationProvider: out.verificationProvider ?? 'none',
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
    async verifyEmail(verificationCode) {
      if (!verificationCode) {
        throw new Error('Code de verification requis');
      }
      if (!pendingVerification?.email) {
        throw new Error('Email de verification introuvable');
      }

      const out = await api.verifyEmail({
        email: pendingVerification.email,
        code: verificationCode.trim(),
      });
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
    async resendVerificationCode() {
      if (!pendingVerification?.email) {
        throw new Error('Aucun email en attente');
      }
      const out = await api.resendVerificationCode(pendingVerification.email);
      setPendingVerification((prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          maskedEmail: out.maskedEmail ?? prev.maskedEmail,
          devCode: out.devCode ?? '',
          expiresInMinutes: out.expiresInMinutes ?? prev.expiresInMinutes,
          verificationProvider: out.verificationProvider ?? prev.verificationProvider ?? 'none',
        };
      });
      return out;
    },
    async login(email, password) {
      try {
        const out = await api.login({ email, password });
        setToken(out.token);
        setUser(out.user);
        setPendingVerification(null);
      } catch (error) {
        if (String(error.message ?? '').toLowerCase().includes('email not verified')) {
          setPendingVerification({
            email: email.trim(),
            maskedEmail: email.trim(),
            onboardingPayload: null,
            devCode: '',
            expiresInMinutes: 15,
            verificationProvider: 'none',
          });
        }
        throw error;
      }
    },
    async refreshProfile() {
      if (!token) return null;
      try {
        const profile = await api.profile(token);
        setUser(profile);
        return profile;
      } catch (error) {
        if (isUnauthorizedError(error)) {
          hardLogout();
          return null;
        }
        throw error;
      }
    },
    async updateSettings(settingsPayload) {
      if (!token) {
        throw new Error('Session invalide');
      }
      try {
        const profile = await api.updateSettings(token, settingsPayload);
        setUser(profile);
        return profile;
      } catch (error) {
        if (isUnauthorizedError(error)) {
          hardLogout();
          throw new Error('Session expiree. Reconnecte-toi.');
        }
        throw error;
      }
    },
    setUser,
    logout() {
      hardLogout();
    },
  }), [token, user, pendingVerification, hydrated, setUser]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession must be used in SessionProvider');
  }
  return value;
}
