import { useCallback } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { detectDefaultLang, translate } from './index.js';

export const useLangStore = create(
  persist(
    (set) => ({
      lang: detectDefaultLang(),
      setLang: (lang) => set({ lang })
    }),
    { name: 'ep_lang', version: 1 }
  )
);

// t('checkout.pay') -> строка на текущем языке, с подстановкой {vars}.
export function useT() {
  const lang = useLangStore((s) => s.lang);
  // Стабильная ссылка: t участвует в зависимостях эффектов, и новая функция
  // на каждый рендер заставляла бы таймеры пересоздаваться без причины.
  return useCallback((key, vars) => translate(lang, key, vars), [lang]);
}

export function useLang() {
  return useLangStore((s) => s.lang);
}
