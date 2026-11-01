import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { subscribeOrder } from '../lib/api.js';
import { MY_ORDERS_EVENT, getMyOrderIds, isOrderAcknowledged } from '../lib/myOrders.js';
import { restaurantById } from '../data/index.js';
import { formatClock, formatMoney, pluralPortions } from '../lib/time.js';
import { BagIcon, ChevronDownIcon, ReceiptIcon } from './Icons.jsx';
import Sheet from './Sheet.jsx';
import { useCartSummary } from '../store/useCart.js';
import { useLang, useT } from '../lib/i18n/store.js';

// Отменённый заказ показываем 30 минут — этого хватает, чтобы клиент заметил отмену
// и нажал «Понял(а)». Готовый заказ, который так и не забрали, не держим в панели
// дольше 3 часов: он остаётся в «Моих заказах», но не мешает собирать новый.
const CANCELLED_VISIBLE_MS = 30 * 60 * 1000;
const READY_VISIBLE_MS = 3 * 60 * 60 * 1000;
const DESKTOP_QUERY = '(min-width: 1024px)';

// На десктопе на экране меню нет нижней CartBar — корзина живёт в боковой панели.
// От этого зависит, нужно ли ставить панель заказов над CartBar или можно прижать к низу.
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

export default function ActiveOrdersBar() {
  const isDesktop = useIsDesktop();
  const t = useT();
  const lang = useLang();
  const { pathname } = useLocation();
  const [ids, setIds] = useState(getMyOrderIds);
  const [orders, setOrders] = useState({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [, setTick] = useState(0);
  const cart = useCartSummary();

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

  // Раз в минуту пересчитываем «свежесть» отменённого/готового заказа, чтобы панель
  // исчезала по времени даже без новых событий от бэкенда.
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const now = Date.now();
  const visibleOrders = ids
    .map((id) => orders[id])
    .filter((order) => {
      if (!order || order.status === 'done') return false;
      if (order.status === 'cancelled') {
        // «Понял(а)» убирает отменённый заказ только из активной панели —
        // в истории он остаётся навсегда.
        if (isOrderAcknowledged(order.id)) return false;
        return now - (order.cancelledAt || order.createdAt || 0) < CANCELLED_VISIBLE_MS;
      }
      if (order.status === 'ready') {
        return now - (order.readyAt || order.createdAt || 0) < READY_VISIBLE_MS;
      }
      return true;
    })
    // Сначала готовый заказ (его можно забрать прямо сейчас), затем ближайшая выдача.
    .sort((a, b) => {
      if (a.status === 'ready' && b.status !== 'ready') return -1;
      if (b.status === 'ready' && a.status !== 'ready') return 1;
      return a.pickupAt - b.pickupAt;
    });

  const hasCart = cart.units > 0 && Boolean(cart.restaurantId);
  const cartPath = cart.restaurantId ? `/restaurant/${cart.restaurantId}` : '/';
  // На странице меню с этой же корзиной корзина уже показана: на мобильном — нижней
  // CartBar, на десктопе — боковой панелью. Корзину там не дублируем, но активный заказ
  // всё равно показываем — на мобильном панель встаёт над CartBar, а не вместо неё.
  const onCartPage = hasCart && pathname === cartPath;
  const showCartInBar = hasCart && !onCartPage;
  const stackWithCartBar = onCartPage && !isDesktop;
  const isStaff = pathname.startsWith('/staff') || pathname.startsWith('/admin');
  // Единственный активный заказ на своём же экране чека и пустая корзина — панель
  // ничего не добавляет: она ведёт туда, где пользователь уже находится.
  const onOwnOrderPage =
    !hasCart && visibleOrders.length === 1 && pathname === `/order/${visibleOrders[0].id}`;
  const visible = !isStaff && !onOwnOrderPage && (visibleOrders.length > 0 || showCartInBar);

  useEffect(() => {
    document.body.classList.toggle('has-active-orders-bar', visible);
    document.body.classList.toggle('has-cart-bar', visible && stackWithCartBar);
    return () => {
      document.body.classList.remove('has-active-orders-bar');
      document.body.classList.remove('has-cart-bar');
    };
  }, [visible, stackWithCartBar]);

  useEffect(() => {
    if (!visible) setSheetOpen(false);
  }, [visible]);

  const statusKey = (order) =>
    order.status === 'ready'
      ? 'orderStatus.ready'
      : order.status === 'cancelled'
        ? 'orderStatus.cancelled'
        : order.status === 'cooking'
          ? 'orderStatus.cooking'
          : 'orderStatus.pending';
  const statusText = (order) => t(statusKey(order));

  const orderCount = visibleOrders.length;
  const single = orderCount === 1 ? visibleOrders[0] : null;
  const combined = showCartInBar && orderCount > 0;
  const cartOnly = showCartInBar && orderCount === 0;
  // Компактный состав корзины для нижней панели: количество и названия без картинок,
  // длинный список обрезается CSS — интерфейс не должен разрастаться на весь экран.
  const cartDishNames = cart.lines.map(({ dish, qty }) => `${qty}× ${dish.name}`).join(' · ');

  // Цвет панели отражает статус заказа на любом экране, в том числе когда рядом
  // собрана корзина. Приоритет: красный (есть отменённый заказ), затем зелёный
  // (есть готовый), иначе фирменный оранжевый. Если заказов нет — панель просто
  // показывает корзину и остаётся оранжевой.
  const hasCancelled = visibleOrders.some((o) => o.status === 'cancelled');
  const hasReady = visibleOrders.some((o) => o.status === 'ready');
  const tone =
    orderCount === 0 ? 'default' : hasCancelled ? 'cancelled' : hasReady ? 'ready' : 'default';

  const barTone =
    tone === 'ready'
      ? { bar: 'bg-accent text-primary', secondary: 'text-primary/70', icon: 'bg-black/10' }
      : tone === 'cancelled'
        ? { bar: 'bg-danger text-white', secondary: 'text-white/75', icon: 'bg-white/20' }
        : { bar: 'bg-brand text-white', secondary: 'text-white/75', icon: 'bg-white/20' };

  let primary;
  let secondary = '';
  let to = null;
  if (cartOnly) {
    const cartRestaurantName = restaurantById[cart.restaurantId]?.name;
    primary = cartRestaurantName
      ? t('cart.continueIn', { name: cartRestaurantName })
      : t('cart.continue');
    secondary = [cartDishNames, formatMoney(cart.total)].filter(Boolean).join(' · ');
    to = cartPath;
  } else if (single && !showCartInBar) {
    primary = t('activeOrders.single', { code: single.code, status: statusText(single) });
    secondary = [restaurantById[single.restaurantId]?.name, formatClock(single.pickupAt)]
      .filter(Boolean)
      .join(' · ');
    to = `/order/${single.id}`;
  } else {
    primary = single
      ? t('activeOrders.single', { code: single.code, status: statusText(single) })
      : t('activeOrders.many', { count: orderCount });
    if (combined) secondary = `${t('cart.title')} · ${formatMoney(cart.total)}`;
  }

  const content = (
    <>
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${barTone.icon}`}
        aria-hidden="true"
      >
        {showCartInBar ? <BagIcon className="h-4 w-4" /> : <ReceiptIcon className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold leading-tight">{primary}</span>
        {secondary && (
          <span className={`mt-0.5 block truncate text-[11px] font-medium ${barTone.secondary}`}>
            {secondary}
          </span>
        )}
      </span>
      <ChevronDownIcon
        className={`h-4 w-4 shrink-0 -rotate-90 ${barTone.secondary}`}
        aria-hidden="true"
      />
    </>
  );

  const barClass = `pointer-events-auto mx-auto flex w-full max-w-[448px] items-center gap-3 rounded-2xl px-4 py-2.5 shadow-2xl transition-colors ${barTone.bar}`;

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            key="active-orders-bar"
            className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            style={
              stackWithCartBar ? { bottom: 'calc(env(safe-area-inset-bottom) + 5rem)' } : undefined
            }
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          >
            {/* Одна интерактивная область на всю панель: не бывает кнопки внутри кнопки. */}
            {to ? (
              <Link to={to} className={barClass}>
                {content}
              </Link>
            ) : (
              <button type="button" onClick={() => setSheetOpen(true)} className={barClass}>
                {content}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        label={combined ? t('activeOrders.sheetLabelCombined') : t('activeOrders.sheetLabel')}
      >
        <h2 className="font-extrabold text-xl text-ink">
          {combined ? t('activeOrders.sheetLabelCombined') : t('activeOrders.sheetLabel')}
        </h2>
        <p className="text-sm text-muted mt-1">
          {combined ? t('activeOrders.sheetHintCombined') : t('activeOrders.sheetHint')}
        </p>

        {showCartInBar && (
          <Link
            to={cartPath}
            onClick={() => setSheetOpen(false)}
            className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-paper px-4 py-3 transition-colors hover:border-ink/20"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <BagIcon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-muted">
                {restaurantById[cart.restaurantId]?.name}
              </span>
              <span className="block font-extrabold text-ink">{t('cart.title')}</span>
              <span className="block text-xs text-muted mt-0.5">
                {pluralPortions(cart.units, lang)} · {formatMoney(cart.total)}
              </span>
              {cartDishNames && (
                <span className="block truncate text-xs text-muted mt-0.5">{cartDishNames}</span>
              )}
            </span>
            <ChevronDownIcon
              className="h-4 w-4 shrink-0 -rotate-90 text-muted"
              aria-hidden="true"
            />
          </Link>
        )}

        {showCartInBar && orderCount > 0 && (
          <div className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">
            {t('activeOrders.ordersSection')}
          </div>
        )}

        <ul className="mt-3 flex flex-col gap-2">
          {visibleOrders.map((order) => (
            <li key={order.id}>
              <Link
                to={`/order/${order.id}`}
                onClick={() => setSheetOpen(false)}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper px-4 py-3 transition-colors hover:border-ink/20"
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs text-muted">
                    {restaurantById[order.restaurantId]?.name}
                  </span>
                  <span className="block text-2xl font-extrabold text-ink leading-tight">
                    {order.code}
                  </span>
                  <span className="block text-xs text-muted mt-0.5">
                    {t('myorders.pickupAt', { time: formatClock(order.pickupAt) })}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    order.status === 'ready'
                      ? 'bg-accent text-primary'
                      : order.status === 'cancelled'
                        ? 'bg-danger text-white'
                        : 'bg-card text-muted border border-line'
                  }`}
                >
                  {statusText(order)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
