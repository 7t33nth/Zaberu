import QtyControl from './QtyControl.jsx';
import { formatMoney, pluralPortions } from '../lib/time.js';
import { useLang, useT } from '../lib/i18n/store.js';

// Десктопная замена нижней CartBar: та же корзина, но как постоянная боковая панель,
// а не всплывающая снизу плашка (см. RestaurantMenu.jsx, видна только от 1024px).
export default function CartSidebar({ lines, total, units, onInc, onDec, onCheckout, disabled }) {
  const t = useT();
  const lang = useLang();
  return (
    <div className="bg-card border border-line rounded-2xl p-5">
      <div className="font-extrabold text-ink text-lg">{t('cart.title')}</div>
      {lines.length === 0 ? (
        <p className="text-sm text-muted mt-3">{t('cart.empty')}</p>
      ) : (
        <>
          <ul className="mt-4 flex flex-col gap-3 max-h-[380px] overflow-y-auto pr-1">
            {lines.map(({ dish, qty }) => (
              <li key={dish.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink truncate">{dish.name}</div>
                  <div className="text-xs text-muted">{formatMoney(dish.price)}</div>
                </div>
                <QtyControl qty={qty} onInc={() => onInc(dish)} onDec={() => onDec(dish.id)} disabled={disabled} />
              </li>
            ))}
          </ul>
          <div className="flex justify-between font-bold text-ink border-t border-line pt-3 mt-4">
            <span>{pluralPortions(units, lang)}</span>
            <span>{formatMoney(total)}</span>
          </div>
          <button
            type="button"
            onClick={onCheckout}
            className="w-full mt-4 bg-brand text-white font-bold py-3.5 rounded-xl"
          >
            {t('cart.chooseTime')}
          </button>
        </>
      )}
    </div>
  );
}
