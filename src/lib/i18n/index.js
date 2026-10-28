import ru from './ru.js';
import kk from './kk.js';
import en from './en.js';

export const LANGS = ['ru', 'kk', 'en'];
const DICTS = { ru, kk, en };

export function detectDefaultLang() {
  const nav = (typeof navigator !== 'undefined' && navigator.language) || '';
  const lower = nav.toLowerCase();
  if (lower.startsWith('kk') || lower.startsWith('kz')) return 'kk';
  if (lower.startsWith('en')) return 'en';
  return 'ru';
}

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (m, key) => (vars[key] != null ? vars[key] : m));
}

export function translate(lang, key, vars) {
  const dict = DICTS[lang] || DICTS.ru;
  const str = dict[key] ?? DICTS.ru[key] ?? key;
  return interpolate(str, vars);
}
