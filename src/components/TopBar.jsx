import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ThemeToggle from './ThemeToggle.jsx';
import LangSwitch from './LangSwitch.jsx';
import { PwaInstallButton } from './InstallBanner.jsx';
import { ReceiptIcon } from './Icons.jsx';
import { useT } from '../lib/i18n/store.js';
import { MY_ORDERS_EVENT, hasOrderAttention } from '../lib/myOrders.js';

function useOrderAttention() {
  const [attention, setAttention] = useState(hasOrderAttention);
  useEffect(() => {
    const refresh = () => setAttention(hasOrderAttention());
    window.addEventListener(MY_ORDERS_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(MY_ORDERS_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return attention;
}

function AttentionDot() {
  const t = useT();
  return (
    <span
      aria-label={t('topbar.ordersAttention')}
      title={t('topbar.ordersAttention')}
      className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-paper"
    />
  );
}

// Ниже 1024px — тонкая полоска: слева логотип-ссылка на главную, справа утилиты.
// От 1024px — полноценная шапка с логотипом и подписью.
export default function TopBar() {
  const t = useT();
  const attention = useOrderAttention();
  return (
    <div className="bg-paper border-b border-line">
      <div className="flex items-center gap-1 px-3 py-1.5 text-xs lg:hidden">
        <Link
          to="/"
          aria-label={t('topbar.home')}
          title={t('topbar.home')}
          className="mr-auto inline-flex h-9 w-9 shrink-0 items-center justify-center transition-opacity hover:opacity-80"
        >
          <img src="/symbol.png" alt="" className="h-9 w-9 object-contain" />
        </Link>
        {/* На узком экране текст «Мои заказы» не помещается — оставляем иконку
            с подписью для скринридеров. */}
        <Link
          to="/my-orders"
          aria-label={t('topbar.myOrders')}
          title={t('topbar.myOrders')}
          className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:text-ink sm:hidden"
        >
          <ReceiptIcon className="h-4 w-4" />
          {attention && <AttentionDot />}
        </Link>
        <Link
          to="/my-orders"
          className="relative hidden min-h-[40px] shrink-0 items-center whitespace-nowrap px-1 font-semibold text-muted transition-colors hover:text-ink sm:inline-flex"
        >
          {t('topbar.myOrders')}
          {attention && <AttentionDot />}
        </Link>
        {/* На самых узких экранах (320–359px) кнопка установки не помещается в один
            ряд с логотипом и языками. Установку там предлагает нижний баннер,
            поэтому в шапке прячем именно её — навигация важнее. */}
        <div className="shrink-0 max-[359px]:hidden">
          <PwaInstallButton />
        </div>
        <LangSwitch />
        <ThemeToggle />
      </div>

      <div className="hidden lg:flex items-center justify-between px-10 py-3.5 max-w-[1340px] mx-auto">
        <Link
          to="/"
          className="flex items-center gap-3 font-extrabold text-[31.5px] text-ink tracking-tight hover:opacity-90 transition-opacity"
        >
          <img src="/symbol.png" alt="Заберу!" className="w-12 h-12 object-contain" />
          <span>Заберу!</span>
        </Link>
        <div className="flex items-center gap-6">
          <PwaInstallButton />
          <Link
            to="/my-orders"
            className="relative font-semibold text-sm text-muted hover:text-ink transition-colors"
          >
            {t('topbar.orderHistory')}
            {attention && <AttentionDot />}
          </Link>
          <LangSwitch />
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
