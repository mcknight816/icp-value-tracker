import { useCallback, useEffect, useState } from "react";
import {
  type LangCode,
  type TranslationKey,
  translations,
} from "./translations";

const STORAGE_KEY = "icp-tracker-language";
const SUPPORTED: LangCode[] = ["en", "es", "fr", "de", "zh", "ja", "pt"];

function getStoredLanguage(): LangCode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && SUPPORTED.includes(raw as LangCode)) return raw as LangCode;
  } catch {
    // SSR/private browsing fallback
  }
  return "en";
}

// Module-level state so language changes are instant and global without a Provider
let _currentLang: LangCode = getStoredLanguage();
const _listeners = new Set<() => void>();

function notifyAll() {
  for (const listener of _listeners) listener();
}

export function setLanguage(lang: LangCode) {
  if (lang === _currentLang) return;
  _currentLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignore
  }
  notifyAll();
}

export function getLanguage(): LangCode {
  return _currentLang;
}

export function useLanguage() {
  const [lang, setLang] = useState<LangCode>(_currentLang);

  useEffect(() => {
    function onUpdate() {
      setLang(_currentLang);
    }
    _listeners.add(onUpdate);
    return () => {
      _listeners.delete(onUpdate);
    };
  }, []);

  const changeLanguage = useCallback((next: LangCode) => {
    setLanguage(next);
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      return translations[lang]?.[key] ?? translations.en[key] ?? key;
    },
    [lang],
  );

  return {
    lang,
    setLanguage: changeLanguage,
    t,
    supportedLanguages: SUPPORTED,
  };
}

export type { LangCode, TranslationKey };
