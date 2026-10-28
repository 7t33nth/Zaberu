import { motion } from 'framer-motion';
import { formatMoney } from '../lib/time.js';
import QtyControl from './QtyControl.jsx';
import Thumb from './Thumb.jsx';
import { useT } from '../lib/i18n/store.js';

export default function DishCard({ dish, qty, disabled, onOpen, onAdd, onDecrement }) {
  const t = useT();
  const soldOut = !dish.available;
  return (
    <article
      className={`flex gap-3 bg-card rounded-xl2 p-3 border ${
        soldOut ? 'border-line bg-paper/50' : 'border-line hover:border-ink/20'
      } transition-colors`}
    >
      <button
        type="button"
        onClick={() => onOpen(dish)}
        className="w-[72px] h-[72px] rounded-xl shrink-0 overflow-hidden border border-line"
        aria-label={t('dish.detailsAria', { name: dish.name })}
      >
        <Thumb src={dish.image} className="w-full h-full rounded-xl" />
      </button>

      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <button type="button" onClick={() => onOpen(dish)} className="text-left">
          <div className="font-bold text-ink text-[15px] leading-tight">{dish.name}</div>
          {dish.description && (
            <div className="text-xs text-muted mt-1 line-clamp-2">{dish.description}</div>
          )}
        </button>

        <div className="flex items-center justify-between gap-2 mt-2">
          <div className="min-w-0">
            <div className="font-bold text-ink text-sm">{formatMoney(dish.price)}</div>
            <div className="text-xs text-muted">
              {soldOut ? (
                <span className="text-danger font-semibold">{t('dish.soldOut')}</span>
              ) : (
                [dish.weight, t('dish.prepShort', { min: dish.prepMinutes })]
                  .filter(Boolean)
                  .join(' · ')
              )}
            </div>
          </div>

          {!soldOut &&
            (qty > 0 ? (
              <QtyControl
                qty={qty}
                onInc={() => onAdd(dish)}
                onDec={() => onDecrement(dish.id)}
                disabled={disabled}
              />
            ) : (
              <motion.button
                type="button"
                onClick={() => onAdd(dish)}
                disabled={disabled}
                whileTap={{ scale: 0.85 }}
                aria-label={t('dish.addAria', { name: dish.name })}
                className="w-9 h-9 rounded-full bg-brand text-white text-xl font-bold flex items-center justify-center hover:opacity-90 transition-opacity"
              >
                +
              </motion.button>
            ))}
        </div>
      </div>
    </article>
  );
}
