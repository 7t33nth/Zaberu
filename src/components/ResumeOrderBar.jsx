import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { subscribeOrder } from '../lib/api.js';
import { MY_ORDERS_EVENT, getMyOrderIds } from '../lib/myOrders.js';
import { restaurantById } from '../data/index.js';
import { useCartSummary } from '../store/useCart.js';
import { formatMoney, pluralPortions } from '../lib/time.js';
import { BagIcon, ReceiptIcon } from './Icons.jsx';
import { useLang, useT } from '../lib/i18n/store.js';

// Плавающая кнопка возврата к заказу. Живёт вне Shell и поэтому видна на всех
// клиентских экранах: заказ и корзина переживают перезагрузку (localStorage),
// а актуальный статус подтягивается из Firestore/локального бэкенда.
// Кнопка скрывается, когда заказ закрыт и корзина пуста.
export default function ResumeOrderBar() {
  const t = useT();
  const lang = useLang();
  const { pathname } = useLocation();
  const cart = useCartSummary();
  const [ids, setIds] = useState(getMyOrderIds);
  const [orders, setOrders] = useState({});

  // Список заказов этого устройства обновляется после оформления без перезагрузки.
  useEffect(() => {
    const refresh = () => setIds(getMyOrderIds());
    window.addEventListener(MY_ORDERS_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(MY_ORDERS_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  useEffect(() => {
    const unsubs = ids.map((id) =>
      subscribeOrder(id, (order) =>
        setOrders((prev) => (prev[id] === order ? prev : { ...prev, [id]: order }))
      )
    );
    return () => unsubs.forEach((stop) => stop());
  }, [ids]);

  const activeOrder = useMemo(() => {
    const active = ids
      .map((id) => orders[id])
      .filter((order) => order && order.status !== 'done' && order.status !== 'cancelled');
    // Готовый заказ важнее: его можно забрать прямо сейчас.
    active.sort((a, b) => {
      if (a.status === 'ready' && b.status !== 'ready') return -1;
      if (b.status === 'ready' && a.status !== 'ready') return 1;
      return a.pickupAt - b.pickupAt;
    });
    return active[0] || null;
  }, [ids, orders]);

  const isStaff = pathname.startsWith('/staff') || pathname.startsWith('/admin');
  // На этом же экране меню уже есть CartBar с тем же действием — не дублируем CTA.
  const cartBarVisible = Boolean(
    cart.units > 0 && cart.restaurantId && pathname === `/restaurant/${cart.restaurantId}`
  );

  let target = null;
  if (!isStaff && !cartBarVisible) {
    if (activeOrder && pathname !== `/order/${activeOrder.id}`) {
      const restaurantName = restaurantById[activeOrder.restaurantId]?.name;
      target = {
        to: `/order/${activeOrder.id}`,
        label: t('resume.toOrder'),
        hint: [restaurantName, activeOrder.code].filter(Boolean).join(' · '),
        Icon: ReceiptIcon
      };
    } else if (cart.units > 0 && cart.restaurantId) {
      target = {
        to: `/restaurant/${cart.restaurantId}`,
        label: t('resume.continue'),
        hint: `${pluralPortions(cart.units, lang)} · ${formatMoney(cart.total)}`,
        Icon: BagIcon
      };
    }
  }

  const visible = Boolean(target);

  // Освобождаем место внизу страницы, чтобы панель не закрывала последний блок контента.
  useEffect(() => {
    document.body.classList.toggle('has-resume-order-bar', visible);
    return () => document.body.classList.remove('has-resume-order-bar');
  }, [visible]);

  const Icon = target?.Icon;

  return (
    <AnimatePresence>
      {target && Icon && (
        <motion.div
          key="resume-order-bar"
          className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        >
          <Link
            to={target.to}
            className="pointer-events-auto mx-auto flex w-full max-w-[448px] items-center justify-center gap-3 rounded-2xl bg-brand px-5 py-4 text-white shadow-2xl transition-opacity hover:opacity-90 active:opacity-90"
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20"
              aria-hidden="true"
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 text-left leading-tight">
              <span className="block text-lg font-extrabold">{target.label}</span>
              {target.hint && (
                <span className="mt-0.5 block truncate text-xs font-medium text-white/75">
                  {target.hint}
                </span>
              )}
            </span>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
