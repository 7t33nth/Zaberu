import { CheckIcon } from './Icons.jsx';
import { useT } from '../lib/i18n/store.js';

// Показывает, что заказ занимает ровно 3 шага.
export default function Steps({ current }) {
  const t = useT();
  const STEPS = [t('steps.dishes'), t('steps.time'), t('steps.confirm')];
  return (
    <ol className="flex items-center gap-1.5 text-xs" aria-label={t('steps.aria')}>
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < current ? 'done' : n === current ? 'now' : 'next';
        return (
          <li key={label} className="flex items-center gap-1.5" aria-current={state === 'now' ? 'step' : undefined}>
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] ${
                state === 'now'
                  ? 'bg-brand text-white'
                  : state === 'done'
                    ? 'bg-accent text-primary'
                    : 'bg-line text-muted'
              }`}
            >
              {state === 'done' ? <CheckIcon className="w-2.5 h-2.5 text-primary" /> : n}
            </span>
            <span className={state === 'now' ? 'font-bold text-ink' : 'text-muted'}>{label}</span>
            {n < STEPS.length && <span className="w-2 h-px bg-line" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
