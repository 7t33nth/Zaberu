import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const DESKTOP_QUERY = '(min-width: 1024px)';

// Ниже 1024px остаётся нижняя шторка (как и было). От 1024px — тот же компонент
// становится центрированным модальным окном, а не растянутым на всю высоту телефоном:
// на десктопе шторка снизу экрана выглядит как забытый мобильный компонент, а не как дизайн.
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(DESKTOP_QUERY).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isDesktop;
}

export default function Sheet({ open, onClose, label, children }) {
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay"
          className="fixed inset-0 bg-black/60 z-30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      {open &&
        (isDesktop ? (
          <div key="panel-wrap-desktop" className="fixed inset-0 z-40 flex items-center justify-center p-6 pointer-events-none">
            <motion.div
              key="panel-desktop"
              role="dialog"
              aria-modal="true"
              aria-label={label}
              className="pointer-events-auto w-full max-w-[540px] max-h-[85vh] overflow-y-auto bg-card rounded-3xl p-7 shadow-2xl border border-line modal-solid"
              style={{ backgroundColor: 'rgb(var(--color-card))', opacity: 1 }}
              initial={{ scale: 0.95, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 12 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            >
              {children}
            </motion.div>
          </div>
        ) : (
          <motion.div
            key="panel-mobile"
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-[480px] max-h-[92vh] overflow-y-auto bg-card rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] z-40 border-t border-line modal-solid"
            style={{ backgroundColor: 'rgb(var(--color-card))', opacity: 1 }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="w-10 h-1 bg-muted/30 rounded-full mx-auto mb-4" />
            {children}
          </motion.div>
        ))}
    </AnimatePresence>
  );
}
