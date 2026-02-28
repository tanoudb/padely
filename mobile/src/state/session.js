import React, { createContext, useContext, useMemo, useState } from 'react';
import { api } from '../api/client';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);

  const value = useMemo(() => ({
    token,
    user,
    async register(email, password, displayName) {
      const out = await api.register({ email, password, displayName });
      setToken(out.token);
      setUser(out.user);
    },
    async login(email, password) {
      const out = await api.login({ email, password });
      setToken(out.token);
      setUser(out.user);
    },
    logout() {
      setToken('');
      setUser(null);
    },
  }), [token, user]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession must be used in SessionProvider');
  }
  return value;
}
