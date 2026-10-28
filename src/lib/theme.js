import { useCallback, useEffect, useState } from 'react';

const KEY = 'ep_theme';
const media = () =>
  typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function getStored() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

function apply(theme) {
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

// theme: явный выбор пользователя ('light' | 'dark') или null — значит следуем системной.
// effective: что реально показано сейчас (для иконки переключателя).
export function useTheme() {
  const [theme, setTheme] = useState(getStored);
  const [systemDark, setSystemDark] = useState(() => media()?.matches ?? false);

  useEffect(() => {
    apply(theme);
    try {
      if (theme) localStorage.setItem(KEY, theme);
      else localStorage.removeItem(KEY);
    } catch {
      /* приватный режим: не критично */
    }
  }, [theme]);

  useEffect(() => {
    const m = media();
    if (!m) return undefined;
    const onChange = (e) => setSystemDark(e.matches);
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, []);

  const effective = theme ?? (systemDark ? 'dark' : 'light');
  const toggle = useCallback(() => setTheme(effective === 'dark' ? 'light' : 'dark'), [effective]);

  return { effective, toggle };
}
