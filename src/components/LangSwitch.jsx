import { LANGS } from '../lib/i18n/index.js';
import { useLangStore } from '../lib/i18n/store.js';

const LABELS = { ru: 'RU', kk: 'ҚАЗ', en: 'EN' };

export default function LangSwitch() {
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  return (
    <div
      className="flex shrink-0 items-center gap-0.5 bg-card border border-line rounded-full p-0.5 text-xs font-bold"
      role="group"
      aria-label="Language"
    >
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`inline-flex min-h-[40px] items-center px-2 rounded-full transition-colors ${
            lang === l ? 'bg-primary text-white' : 'text-muted hover:text-ink'
          }`}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}
