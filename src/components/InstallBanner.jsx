import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Sheet from './Sheet.jsx';
import { CloseIcon, DownloadIcon, ShareIcon } from './Icons.jsx';
import { useT } from '../lib/i18n/store.js';
import { hideInstallHint, installHintHidden, promptInstall, useInstall } from '../lib/install.js';

// Баннер показываем только там, где есть тач: на десктопе он выглядит навязчиво,
// и установка из браузера там — редкий сценарий (для неё остаётся ссылка в футере).
const COARSE_QUERY = '(pointer: coarse)';

function useCoarsePointer() {
  const [coarse, setCoarse] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(COARSE_QUERY).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(COARSE_QUERY);
    const onChange = () => setCoarse(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return coarse;
}

// Не накрываем первый экран сразу при загрузке: даём человеку увидеть, что это за сервис,
// и только потом предлагаем установку.
function useShownLater(active, delay = 1600) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!active) return undefined;
    const id = setTimeout(() => setReady(true), delay);
    return () => clearTimeout(id);
  }, [active, delay]);
  return ready;
}

function InstallSheet({ open, onClose }) {
  const t = useT();
  const { canPrompt, ios } = useInstall();

  const steps = ios
    ? [
        { text: t('install.iosStep1'), icon: ShareIcon },
        { text: t('install.iosStep2') },
        { text: t('install.iosStep3') }
      ]
    : [
        { text: t('install.otherStep1') },
        { text: t('install.otherStep2') },
        { text: t('install.otherStep3') }
      ];

  const install = async () => {
    const accepted = await promptInstall();
    if (accepted) onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} label={t('install.sheetLabel')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-ink">
            {ios ? t('install.iosHeading') : t('install.otherHeading')}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {ios ? t('install.iosSubtitle') : t('install.otherSubtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('install.close')}
          className="-mr-1 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-paper hover:text-ink"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>

      <ol className="mt-5 flex flex-col gap-4">
        {steps.map(({ text, icon: Icon }, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-extrabold text-brand">
              {Icon ? <Icon className="h-4 w-4" /> : i + 1}
            </span>
            <span className="pt-1 text-sm leading-snug text-ink">{text}</span>
          </li>
        ))}
      </ol>

      {canPrompt && (
        <button
          type="button"
          onClick={install}
          className="mt-6 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          <DownloadIcon className="h-4 w-4" />
          {t('install.button')}
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        className="mt-3 min-h-[44px] w-full rounded-xl bg-paper px-5 text-sm font-bold text-ink transition-colors hover:bg-line"
      >
        {t('install.done')}
      </button>
    </Sheet>
  );
}

export default function InstallBanner() {
  const t = useT();
  const { installed, canPrompt, ios } = useInstall();
  const coarse = useCoarsePointer();
  const [hidden, setHidden] = useState(installHintHidden);
  const [open, setOpen] = useState(false);

  const available = !installed && !hidden && (canPrompt || ios);
  const shownLater = useShownLater(available);
  const visible = available && coarse && shownLater;

  const dismiss = () => {
    hideInstallHint();
    setHidden(true);
  };

  const install = async () => {
    await promptInstall();
    // И при согласии, и при отказе в системном окне напоминание больше не показываем:
    // согласие закрывает вопрос установкой, отказ — это тоже ответ.
    dismiss();
  };

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            initial={{ y: 140, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 140, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          >
            <div className="pointer-events-auto mx-auto w-full max-w-[448px] rounded-3xl border border-line bg-card p-3 shadow-2xl">
              <div className="flex items-start gap-3">
                <img
                  src="/symbol.png"
                  alt=""
                  className="h-11 w-11 shrink-0 rounded-2xl object-contain"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-extrabold leading-tight text-ink">
                    {t('install.title')}
                  </p>
                  <p className="mt-0.5 text-xs leading-snug text-muted">{t('install.subtitle')}</p>
                </div>
                <button
                  type="button"
                  onClick={dismiss}
                  aria-label={t('install.close')}
                  className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-paper hover:text-ink"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={dismiss}
                  className="min-h-[44px] flex-1 rounded-xl bg-paper px-4 text-sm font-bold text-ink transition-colors hover:bg-line"
                >
                  {t('install.later')}
                </button>
                <button
                  type="button"
                  onClick={ios ? () => setOpen(true) : install}
                  className="flex min-h-[44px] flex-[1.4] items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
                >
                  {!ios && <DownloadIcon className="h-4 w-4" />}
                  {ios ? t('install.iosButton') : t('install.button')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <InstallSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

// Ссылка для футера: работает и на десктопе, где баннера нет. Если браузер готов
// показать системное окно — показываем его сразу, иначе открываем инструкцию.
export function InstallLink() {
  const t = useT();
  const { installed, canPrompt } = useInstall();
  const [open, setOpen] = useState(false);

  if (installed) return null;

  const onClick = async () => {
    if (canPrompt) {
      await promptInstall();
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <div className="mt-8 flex justify-center px-4 lg:px-0">
        <button
          type="button"
          onClick={onClick}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-line bg-card px-4 text-sm font-bold text-ink transition-colors hover:border-ink/40"
        >
          <DownloadIcon className="h-4 w-4 text-brand" />
          {t('install.footerCta')}
        </button>
      </div>
      <InstallSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
