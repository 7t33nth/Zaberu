import { AnimatePresence, motion } from 'framer-motion';
import { useCartSummary } from '../store/useCart.js';
import { formatMoney, pluralPortions } from '../lib/time.js';
import { useLang, useT } from '../lib/i18n/store.js';

export default function CartBar({ restaurantId, onNext }) {
  const t = useT();
  const lang = useLang();
  const { restaurantId: cartRestaurant, units, total } = useCartSummary();
  const visible = units > 0 && cartRestaurant === restaurantId;

  return (
    <AnimatePresence>
      {visible && (
        <div className="fixed inset-x-0 bottom-0 z-20 pointer-events-none">
          <motion.button
            type="button"
            onClick={onNext}
            className="pointer-events-auto mx-auto mb-[max(1.25rem,env(safe-area-inset-bottom))] block w-[calc(100%-32px)] max-w-[448px] bg-brand text-white rounded-2xl px-5 py-4 shadow-xl"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
          >
            <span className="flex items-center justify-between font-bold">
              <span>{t('cart.chooseTime')}</span>
              <span>{formatMoney(total)}</span>
            </span>
            <span className="block text-left text-xs text-white/60 font-medium mt-0.5">
              {pluralPortions(units, lang)} · {t('cartbar.step')}
            </span>
          </motion.button>
        </div>
      )}
    </AnimatePresence>
  );
}
