import { motion } from 'framer-motion';
import { useT } from '../lib/i18n/store.js';

export default function QtyControl({ qty, onInc, onDec, disabled, size = 'md' }) {
  const t = useT();
  const dim = size === 'lg' ? 'w-11 h-11 text-xl' : 'w-9 h-9 text-lg';
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onDec}
        aria-label={t('qty.decAria')}
        className={`${dim} rounded-full bg-paper border border-line font-bold text-ink`}
      >
        −
      </button>
      <motion.span
        key={qty}
        initial={{ scale: 1.35 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.18 }}
        className="min-w-6 text-center font-bold text-ink select-none"
        aria-live="polite"
      >
        {qty}
      </motion.span>
      <motion.button
        type="button"
        onClick={onInc}
        disabled={disabled}
        whileTap={{ scale: 0.85 }}
        aria-label={t('qty.incAria')}
        className={`${dim} rounded-full bg-brand text-white font-bold disabled:opacity-30`}
      >
        +
      </motion.button>
    </div>
  );
}
