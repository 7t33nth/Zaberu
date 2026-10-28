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
  return (key, vars) => translate(lang, key, vars);
}

export function useLang() {
  return useLangStore((s) => s.lang);
}
