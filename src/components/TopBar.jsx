import { Link } from 'react-router-dom';
import ThemeToggle from './ThemeToggle.jsx';
import LangSwitch from './LangSwitch.jsx';
import { PwaInstallButton } from './InstallBanner.jsx';
import { ReceiptIcon, HeartIcon } from './Icons.jsx';
import { useT } from '../lib/i18n/store.js';
import { useFavoritesCount } from '../store/useFavorites.js';

// Ниже 1024px — тонкая полоска: слева логотип-ссылка на главную, справа утилиты.
// От 1024px — полноценная шапка с логотипом и подписью.
export default function TopBar() {
  const t = useT();
  const favoritesCount = useFavoritesCount();
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
        <Link
          to="/?filter=favorites"
          aria-label={t('topbar.favorites')}
          title={t('topbar.favorites')}
          className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:text-ink"
        >
          <HeartIcon
            filled={favoritesCount > 0}
            className={`h-4 w-4 ${favoritesCount > 0 ? 'text-danger fill-danger' : 'text-muted'}`}
          />
        </Link>
        {/* На узком экране текст «Мои заказы» не помещается — оставляем иконку
            с подписью для скринридеров. */}
        <Link
          to="/my-orders"
          aria-label={t('topbar.myOrders')}
          title={t('topbar.myOrders')}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:text-ink sm:hidden"
        >
          <ReceiptIcon className="h-4 w-4" />
        </Link>
        <Link
          to="/my-orders"
          className="hidden min-h-[40px] shrink-0 items-center whitespace-nowrap px-1 font-semibold text-muted transition-colors hover:text-ink sm:inline-flex"
        >
          {t('topbar.myOrders')}
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
            to="/?filter=favorites"
            className="flex items-center gap-1.5 font-semibold text-sm text-muted hover:text-ink transition-colors"
          >
            <HeartIcon
              filled={favoritesCount > 0}
              className={`w-4 h-4 ${favoritesCount > 0 ? 'text-danger fill-danger' : 'text-muted'}`}
            />
            <span>{t('topbar.favorites')}</span>
            {favoritesCount > 0 && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand/10 px-1 text-[11px] font-bold text-brand">
                {favoritesCount}
              </span>
            )}
          </Link>
          <Link
            to="/my-orders"
            className="font-semibold text-sm text-muted hover:text-ink transition-colors"
          >
            {t('topbar.myOrders')}
          </Link>
          <LangSwitch />
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
