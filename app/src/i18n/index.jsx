import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import en from './locales/en.js';
import { setFormatLocale } from '../lib/locale.js';

/* Languages offered in the flag picker, in the reference app's order.
   Adding one is a two-line change: an entry here + a locale file. */
export const LANGS = [
  { code: 'en', label: 'English',    flag: '🇺🇸' },
  { code: 'es', label: 'Español',    flag: '🇪🇸' },
  { code: 'fr', label: 'Français',   flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch',    flag: '🇩🇪' },
  { code: 'pt', label: 'Português',  flag: '🇧🇷' },
  { code: 'zh', label: '中文',        flag: '🇨🇳' },
  { code: 'ja', label: '日本語',      flag: '🇯🇵' },
  { code: 'ko', label: '한국어',      flag: '🇰🇷' },
];

const RTL = new Set([]); // none of the eight are RTL; kept for future locales
const STORAGE_KEY = 'deficoins.lang';

/* Vite bundles each locale as its own chunk; only the active one is fetched.
   English is excluded: it ships in the main bundle as the fallback dictionary,
   so pulling it in here too would duplicate it. */
const loaders = import.meta.glob(['./locales/*.js', '!./locales/en.js']);

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && LANGS.some((l) => l.code === v)) return v;
  } catch {}
  try {
    const nav = (navigator.languages || [navigator.language || 'en'])
      .map((l) => String(l).slice(0, 2).toLowerCase());
    const hit = nav.find((l) => LANGS.some((x) => x.code === l));
    if (hit) return hit;
  } catch {}
  return 'en';
}

setFormatLocale(readStored());

const I18nCtx = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(readStored);
  const [dict, setDict] = useState(() => (readStored() === 'en' ? en : null));

  useEffect(() => {
    let alive = true;
    if (lang === 'en') { setDict(en); return; }
    const load = loaders[`./locales/${lang}.js`];
    if (!load) { setDict(en); return; }
    load()
      .then((m) => { if (alive) setDict(m.default || en); })
      .catch(() => { if (alive) setDict(en); });
    return () => { alive = false; };
  }, [lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL.has(lang) ? 'rtl' : 'ltr';
    setFormatLocale(lang);
  }, [lang]);

  const setLang = useCallback((code) => {
    setLangState(code);
    try { localStorage.setItem(STORAGE_KEY, code); } catch {}
  }, []);

  /* t('key', { name: 'Sam' }) — falls back to English, then to the key itself,
     so a missing translation degrades to readable text instead of blank UI. */
  const t = useCallback((key, vars) => {
    const raw = (dict && dict[key]) ?? en[key] ?? key;
    if (!vars) return raw;
    return raw.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  }, [dict]);

  const value = useMemo(
    () => ({ lang, setLang, t, langs: LANGS, current: LANGS.find((l) => l.code === lang) || LANGS[0] }),
    [lang, setLang, t]
  );

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

export function useT() { return useI18n().t; }
