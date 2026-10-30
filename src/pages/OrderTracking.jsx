import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { cancelOrder, markArrived, markReceived, subscribeOrder } from '../lib/api.js';
import { restaurantById } from '../data/index.js';
import { CANCEL_WINDOW_MS, formatClock, formatLeft, formatMoney } from '../lib/time.js';
import { googleMapsUrl } from '../lib/geo.js';
import { useToast } from '../components/Toast.jsx';
import { ClockIcon, LocationIcon } from '../components/Icons.jsx';
import { useLang, useT } from '../lib/i18n/store.js';
import { ensureNotifyPermission, notifyIfHidden } from '../lib/notify.js';
import OrderStatusTracker from '../components/OrderStatusTracker.jsx';
import { OrderTrackingSkeleton } from '../components/Skeletons.jsx';

const ARRIVE_WINDOW_MS = 15 * 60000;
const LEAVE_WINDOW_MS = 10 * 60000; // за сколько до выдачи напоминаем «пора выходить»
const OVERDUE_WINDOW_MS = 5 * 60000; // через сколько после выдачи напоминаем, что заказ ждёт

export default function OrderTracking() {
  const { orderId } = useParams();
  const t = useT();
  const lang = useLang();
  const STATUS = {
    pending: { text: t('order.statusPending'), tone: 'bg-paper text-ink border border-line' },
    ready: { text: t('order.statusReady'), tone: 'bg-accent text-primary' },
    done: { text: t('order.statusDone'), tone: 'bg-accent-soft text-accent-dark' },
    cancelled: { text: t('order.statusCancelled'), tone: 'bg-danger-soft text-danger' }
  };
  const [order, setOrder] = useState(undefined); // undefined = грузим, null = не найден
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [toast, toastNode] = useToast();

  useEffect(() => subscribeOrder(orderId, setOrder), [orderId]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Спрашиваем разрешение на уведомления один раз, пока заказ ещё готовится — момент,
  // когда пользователю действительно есть смысл согласиться («сообщите, когда будет готово»).
  useEffect(() => {
    if (order?.status === 'pending') ensureNotifyPermission();
  }, [order?.id, order?.status]);

  // Напоминание «пора выходить» за LEAVE_WINDOW_MS до выдачи — toast, если вкладка открыта,
  // плюс системное уведомление, если она свёрнута/в фоне (см. lib/notify.js).
  useEffect(() => {
    if (!order || order.status !== 'pending') return undefined;
    const delay = order.pickupAt - LEAVE_WINDOW_MS - Date.now();
    if (delay <= 0) return undefined; // уже в окне «пора» или время прошло — не шлём задним числом
    const timer = setTimeout(() => {
      const text = t('order.toastLeave', { time: formatClock(order.pickupAt) });
      toast(text);
      notifyIfHidden(text, order.code);
    }, delay);
    return () => clearTimeout(timer);
  }, [order, toast, t]);

  // Время выдачи прошло, а человек ещё не отметился «я на месте» — напоминаем один раз.
  // Это не спам по таймеру: срабатывает ровно через OVERDUE_WINDOW_MS, и только пока
  // заказ не выдан, не отменён и не отмечен как «пришёл».
  useEffect(() => {
    if (!order || order.status !== 'pending' || order.arrivedAt) return undefined;
    const delay = order.pickupAt + OVERDUE_WINDOW_MS - Date.now();
    if (delay <= 0) return undefined;
    const timer = setTimeout(() => {
      toast(t('order.toastWaiting'));
      notifyIfHidden(t('order.toastWaiting'), order.code);
    }, delay);
    return () => clearTimeout(timer);
  }, [order, toast, t]);

  // Смену статуса на ready ловит глобальный useOrderNotifications в App: так toast
  // и системное уведомление приходят на любом экране, а не только здесь.

  if (order === undefined) {
    return <OrderTrackingSkeleton />;
  }

  if (order === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh px-8 text-center">
        <h1 className="font-extrabold text-xl text-ink">{t('order.notFoundHeading')}</h1>
        <p className="text-muted text-sm mt-2">{t('order.notFoundText')}</p>
        <Link to="/" className="mt-6 bg-brand text-white font-bold px-6 py-3 rounded-xl">
          {t('order.newOrder')}
        </Link>
      </div>
    );
  }

  const restaurant = restaurantById[order.restaurantId];
  const msLeft = order.pickupAt - now;
  const status = STATUS[order.status] || STATUS.pending;
  const finished = order.status === 'done' || order.status === 'cancelled';
  const canArrive = !finished && !order.arrivedAt && msLeft <= ARRIVE_WINDOW_MS;
  const cancelMsLeft = order.status === 'pending' ? order.createdAt + CANCEL_WINDOW_MS - now : -1;
  const canCancel = cancelMsLeft > 0;

  async function arrive() {
    setBusy(true);
    try {
      await markArrived(order.id);
    } catch (err) {
      console.error(err);
      toast(t('order.actionFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!window.confirm(t('order.cancelConfirm'))) return;
    setBusy(true);
    try {
      await cancelOrder(order.id);
    } catch (err) {
      console.error(err);
      toast(t('order.actionFailed'));
    } finally {
      setBusy(false);
    }
  }

  // Подтверждение получения: единственный способ разблокировать кухне кнопку «Выдано».
  // Если заказ уже закрыли (или отменили), переход не сработает — объясняем почему.
  async function confirmReceived() {
    setBusy(true);
    try {
      const ok = await markReceived(order.id);
      if (!ok) toast(t('order.receivedClosed'));
    } catch (err) {
      console.error(err);
      toast(t('order.actionFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col px-5 pt-10 pb-10 min-h-dvh lg:max-w-[560px] lg:mx-auto lg:pt-16">
      {toastNode}
      <div className="text-center">
        <span className={`inline-block px-4 py-2 rounded-full text-sm font-bold ${status.tone}`}>
          {status.text}
        </span>

        <div className="text-sm text-muted mt-8">{t('order.numberLabel')}</div>
        <div className="text-7xl font-extrabold text-ink leading-none mt-2">{order.code}</div>
        <div className="text-sm text-muted mt-2">
          {order.name ? t('order.showCodeNamed', { name: order.name }) : t('order.showCode')}
        </div>

        {/* Подтверждение получения: пока клиент не нажал «Да», кухня не может закрыть
            заказ в одностороннем порядке. Через 3 часа после выдачи это право появляется
            само — см. AdminBoard и RECEIVE_GRACE_MS. */}
        {order.status === 'ready' && !order.receivedAt && (
          <div className="mx-auto mt-5 max-w-[380px] rounded-xl2 border border-accent bg-accent-soft p-4 text-left">
            <div className="font-extrabold text-ink">{t('order.receivedQuestion')}</div>
            <p className="mt-1 text-xs text-muted">{t('order.receivedHint')}</p>
            <button
              type="button"
              onClick={confirmReceived}
              disabled={busy}
              className="mt-3 w-full rounded-xl bg-accent py-3 font-bold text-primary transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {t('order.receivedYes')}
            </button>
          </div>
        )}
        {order.status === 'ready' && order.receivedAt && (
          <div className="mx-auto mt-5 max-w-[380px] rounded-xl2 border border-accent bg-accent-soft px-4 py-3 text-sm font-bold text-accent-dark">
            {t('order.receivedThanks')}
          </div>
        )}

        {canCancel && (
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="block mx-auto mt-4 text-sm font-semibold text-danger underline-offset-2 hover:underline disabled:opacity-40"
          >
            {t('order.cancelOrder', { seconds: Math.ceil(cancelMsLeft / 1000) })}
          </button>
        )}
      </div>

      <div className="mt-8 bg-card rounded-xl2 border border-line p-5 text-center">
        <div className="text-xs text-muted">{t('checkout.pickupAtLabel')}</div>
        <div className="text-5xl font-extrabold text-ink mt-1">{formatClock(order.pickupAt)}</div>
        {!finished && (
          <div
            className={`inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-full text-lg font-extrabold ${
              msLeft < 0
                ? 'bg-danger-soft text-danger'
                : msLeft <= 5 * 60000
                  ? 'bg-brand-soft text-brand'
                  : 'bg-accent-soft text-accent-dark'
            }`}
          >
            <ClockIcon className="w-5 h-5 shrink-0" />
            <span>
              {msLeft >= 0
                ? t('order.in', { time: formatLeft(msLeft, lang) })
                : t('order.ago', { time: formatLeft(msLeft, lang) })}
            </span>
          </div>
        )}
      </div>

      {/* Трекер прогресса заказа в реальном времени */}
      <div className="mt-4">
        <OrderStatusTracker orderId={order.id} initialOrder={order} />
      </div>

      {restaurant && (
        <div className="mt-4 bg-card rounded-xl2 border border-line p-4 text-sm">
          <div className="font-bold text-ink">{restaurant.name}</div>
          <div className="flex items-center gap-1.5 text-muted mt-1">
            <LocationIcon className="w-3.5 h-3.5 text-muted shrink-0" />
            <span>{restaurant.address}</span>
          </div>
          {Number.isFinite(restaurant.lat) && Number.isFinite(restaurant.lon) && (
            <a
              href={googleMapsUrl(restaurant.lat, restaurant.lon)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 font-semibold text-accent-dark hover:underline"
            >
              {t('order.showOnMap')}
            </a>
          )}
        </div>
      )}

      <ul className="mt-4 bg-card rounded-xl2 border border-line p-4 text-sm flex flex-col gap-1.5">
        {order.items.map((it) => (
          <li key={it.id} className="flex justify-between">
            <span className="text-ink">
              <b>{it.qty}×</b> {it.name}
            </span>
            <span className="text-muted">{formatMoney(it.qty * it.price)}</span>
          </li>
        ))}
        <li className="flex justify-between font-bold text-ink border-t border-line pt-2 mt-1">
          <span>
            {order.pay === 'kaspi' ? t('order.totalPaidKaspi') : t('order.totalPaidOnline')}
          </span>
          <span>{formatMoney(order.total)}</span>
        </li>
      </ul>

      {order.comment && (
        <div className="mt-4 bg-card rounded-xl2 border border-line p-4 text-sm">
          <div className="text-xs text-muted">{t('order.commentLabel')}</div>
          <div className="text-ink mt-0.5">{order.comment}</div>
        </div>
      )}

      <div className="mt-6">
        {!finished && (
          <>
            <button
              type="button"
              onClick={arrive}
              disabled={!canArrive || busy}
              className="w-full bg-brand text-white font-bold py-4 rounded-xl disabled:opacity-40"
            >
              {order.arrivedAt ? t('order.weKnow') : t('order.imHere')}
            </button>
            <p className="text-center text-xs text-muted mt-2">
              {order.arrivedAt
                ? t('order.hintKnown')
                : canArrive
                  ? t('order.hintCanArrive')
                  : t('order.hintTooEarly')}
            </p>
          </>
        )}
        {finished && (
          <Link
            to="/"
            className="block text-center w-full bg-brand text-white font-bold py-4 rounded-xl"
          >
            {t('order.newOrder')}
          </Link>
        )}
        {!finished && (
          <Link to="/" className="block text-center text-muted text-sm underline mt-6">
            {t('order.backToRestaurants')}
          </Link>
        )}
      </div>
    </div>
  );
}
