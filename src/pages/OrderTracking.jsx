import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { cancelOrder, markArrived, subscribeOrder } from '../lib/api.js';
import { restaurantById } from '../data/index.js';
import { CANCEL_WINDOW_MS, formatClock, formatLeft, formatMoney } from '../lib/time.js';
import { useToast } from '../components/Toast.jsx';
import { ClockIcon, LocationIcon } from '../components/Icons.jsx';
import { useLang, useT } from '../lib/i18n/store.js';
import { ensureNotifyPermission, notifyIfHidden } from '../lib/notify.js';

const ARRIVE_WINDOW_MS = 15 * 60000;
const SOON_WINDOW_MS = 5 * 60000; // за сколько до выдачи предупреждаем «скоро будет готово»

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
  const prevStatusRef = useRef();

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

  // разовое напоминание за SOON_WINDOW_MS до выдачи — toast, если вкладка открыта,
  // плюс системное уведомление, если она свёрнута/в фоне (см. lib/notify.js).
  useEffect(() => {
    if (!order || order.status !== 'pending') return undefined;
    const delay = order.pickupAt - SOON_WINDOW_MS - Date.now();
    if (delay <= 0) return undefined; // уже в окне «скоро» или время прошло — не шлём задним числом
    const timer = setTimeout(() => {
      toast(t('order.toastSoon'));
      notifyIfHidden(t('order.toastSoon'), order.code);
    }, delay);
    return () => clearTimeout(timer);
  }, [order?.id, order?.pickupAt, order?.status, toast, t]);

  // кухня отметила заказ готовым — реальный статус, а не таймер по времени выдачи
  useEffect(() => {
    if (!order) return;
    if (prevStatusRef.current && prevStatusRef.current !== 'ready' && order.status === 'ready') {
      toast(t('order.toastReady'));
      notifyIfHidden(t('order.toastReady'), order.code);
    }
    prevStatusRef.current = order.status;
  }, [order?.status, toast, t]);

  if (order === undefined) {
    return <div className="flex items-center justify-center min-h-screen text-muted">{t('order.loading')}</div>;
  }

  if (order === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-8 text-center">
        <h1 className="font-extrabold text-xl text-ink">{t('order.notFoundHeading')}</h1>
        <p className="text-muted text-sm mt-2">
          {t('order.notFoundText')}
        </p>
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
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!window.confirm(t('order.cancelConfirm'))) return;
    setBusy(true);
    try {
      await cancelOrder(order.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col px-5 pt-10 pb-10 min-h-screen lg:max-w-[560px] lg:mx-auto lg:pt-16">
      {toastNode}
      <div className="text-center">
        <span className={`inline-block px-4 py-2 rounded-full text-sm font-bold ${status.tone}`}>{status.text}</span>

        <div className="text-sm text-muted mt-8">{t('order.numberLabel')}</div>
        <div className="text-7xl font-extrabold text-ink leading-none mt-2">{order.code}</div>
        <div className="text-sm text-muted mt-2">
          {order.name ? t('order.showCodeNamed', { name: order.name }) : t('order.showCode')}
        </div>

        {/* QR всегда чёрным по белому — его должна уметь прочитать камера/сканер независимо от темы */}
        <div className="inline-block bg-white p-3 rounded-xl2 mt-4">
          <QRCodeSVG value={order.code} size={128} bgColor="#FFFFFF" fgColor="#15201C" level="M" />
        </div>

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
            <span>{msLeft >= 0 ? t('order.in', { time: formatLeft(msLeft, lang) }) : t('order.ago', { time: formatLeft(msLeft, lang) })}</span>
          </div>
        )}
      </div>

      {restaurant && (
        <div className="mt-4 bg-card rounded-xl2 border border-line p-4 text-sm">
          <div className="font-bold text-ink">{restaurant.name}</div>
          <div className="flex items-center gap-1.5 text-muted mt-1">
            <LocationIcon className="w-3.5 h-3.5 text-muted shrink-0" />
            <span>{restaurant.address}</span>
          </div>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${restaurant.lat},${restaurant.lon}`}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-2 font-semibold text-accent-dark hover:underline"
          >
            {t('order.showOnMap')}
          </a>
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
          <span>{order.pay === 'kaspi' ? t('order.totalPaidKaspi') : t('order.totalPaidOnline')}</span>
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
          <Link to="/" className="block text-center w-full bg-brand text-white font-bold py-4 rounded-xl">
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
