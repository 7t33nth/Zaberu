import { useTheme } from '../lib/theme.js';
import { useT } from '../lib/i18n/store.js';
import { SunIcon, MoonIcon } from './Icons.jsx';

export default function ThemeToggle() {
  const { effective, toggle } = useTheme();
  const t = useT();
  const dark = effective === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? t('theme.lightOn') : t('theme.darkOn')}
      aria-pressed={dark}
      className="w-8 h-8 rounded-full bg-card border border-line flex items-center justify-center text-ink hover:border-ink/40 transition-colors shadow-sm"
    >
      <span aria-hidden="true">
        {dark ? (
          <SunIcon className="w-4 h-4 text-warn" />
        ) : (
          <MoonIcon className="w-4 h-4 text-muted" />
        )}
      </span>
    </button>
  );
}
