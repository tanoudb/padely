import React, { createContext, useContext, useMemo, useState } from 'react';
import { dictionaries } from '../i18n/dictionaries';

const I18nContext = createContext(null);

function readPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function formatMessage(message, vars = {}) {
  return String(message).replace(/\{(\w+)\}/g, (_, name) => {
    if (vars[name] === undefined || vars[name] === null) {
      return '';
    }
    return String(vars[name]);
  });
}

export function I18nProvider({ children }) {
  const [language, setLanguage] = useState('fr');

  const value = useMemo(() => ({
    language,
    setLanguage(next) {
      if (!dictionaries[next]) return;
      setLanguage(next);
    },
    t(key, vars, fallback = key) {
      const dict = dictionaries[language] ?? dictionaries.fr;
      const defaultDict = dictionaries.fr;
      const hit = readPath(dict, key);
      const finalValue = hit ?? readPath(defaultDict, key) ?? fallback;
      return formatMessage(finalValue, vars);
    },
  }), [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error('useI18n must be used in I18nProvider');
  }
  return value;
}
