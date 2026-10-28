import { Link } from 'react-router-dom';
import ThemeToggle from './ThemeToggle.jsx';
import LangSwitch from './LangSwitch.jsx';
import { useT } from '../lib/i18n/store.js';

// Ниже 1024px — тонкая полоска утилитных ссылок. От 1024px — полноценная шапка с логотипом.
export default function TopBar() {
  const t = useT();
  return (
    <div className="bg-paper border-b border-line">
      <div className="flex items-center justify-end gap-3 px-4 py-2 text-xs lg:hidden">
        <Link to="/my-orders" className="font-semibold text-muted hover:text-ink transition-colors">
          {t('topbar.myOrders')}
        </Link>
        <LangSwitch />
        <ThemeToggle />
      </div>

      <div className="hidden lg:flex items-center justify-between px-10 py-3.5 max-w-[1340px] mx-auto">
        <Link
          to="/"
          className="flex items-center gap-3 font-extrabold text-[31.5px] text-ink tracking-tight hover:opacity-90 transition-opacity"
        >
          <img src="/symbol.png" alt="Заберу!" className="w-12 h-12 rounded-2xl object-contain" />
          <span>Заберу!</span>
        </Link>
        <div className="flex items-center gap-6">
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
