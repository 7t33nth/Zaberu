import { useEffect, useState } from 'react';
import { WifiOffIcon } from './Icons.jsx';
import { useT } from '../lib/i18n/store.js';

// Полоска «нет сети». Появляется сама, когда браузер теряет подключение, и убирается,
// когда оно вернулось. Живёт в обычном потоке, а не поверх страницы: так она не
// перекрывает шапку и переключатели языка/темы. Приложение при этом продолжает
// работать на закэшированных данных — полоска лишь объясняет, почему они могли
// не обновиться.
export default function OfflineBanner() {
  const t = useT();
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 bg-ink px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-xs font-semibold text-paper"
    >
      <WifiOffIcon className="w-4 h-4 shrink-0" />
      <span className="min-w-0 text-center">{t('offline.text')}</span>
    </div>
  );
}
