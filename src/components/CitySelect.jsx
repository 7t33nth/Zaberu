import { useState } from 'react';
import Sheet from './Sheet.jsx';
import { LocationIcon } from './Icons.jsx';
import { useT } from '../lib/i18n/store.js';

// Все 18 заведений в датасете — Алматы. Остальные города показаны как "скоро",
// чтобы обозначить план роста на питче, не обещая функциональность, которой нет.
const CITIES = [
  { id: 'almaty', key: 'city.almaty', active: true },
  { id: 'astana', key: 'city.astana', active: false },
  { id: 'shymkent', key: 'city.shymkent', active: false }
];

export default function CitySelect() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const current = CITIES.find((c) => c.active);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 inline-flex min-h-[40px] items-center gap-1.5 bg-card border border-line rounded-full pl-3 pr-2.5 py-1.5 text-sm font-semibold text-ink mt-1 hover:border-ink/40 transition-colors shadow-sm"
      >
        <LocationIcon className="w-3.5 h-3.5 text-brand shrink-0" />
        <span>{t(current.key)}</span>
        <span aria-hidden="true" className="text-muted text-xs">
          ▼
        </span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label={t('city.sheetLabel')}>
        <h2 className="font-extrabold text-xl text-ink">{t('city.heading')}</h2>
        <p className="text-sm text-muted mt-1">{t('city.subtitle')}</p>
        <div className="flex flex-col gap-2 mt-5">
          {CITIES.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={!c.active}
              onClick={() => setOpen(false)}
              aria-pressed={c.active}
              className={`w-full flex items-center justify-between rounded-xl px-4 py-3.5 text-left border transition-colors ${
                c.active
                  ? 'border-brand bg-brand-soft font-bold'
                  : 'border-line bg-paper text-muted cursor-not-allowed'
              }`}
            >
              <span className={`font-semibold ${c.active ? 'text-brand' : 'text-muted'}`}>
                {t(c.key)}
              </span>
              {c.active ? (
                <span className="text-xs font-bold text-brand">{t('city.selected')}</span>
              ) : (
                <span className="text-xs font-semibold text-muted">{t('city.soon')}</span>
              )}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
