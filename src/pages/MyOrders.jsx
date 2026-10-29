import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { subscribeOrder } from '../lib/api.js';
import { getMyOrderIds } from '../lib/myOrders.js';
import { useCart } from '../store/useCart.js';
import { restaurantById } from '../data/index.js';
import { formatClock, formatMoney } from '../lib/time.js';
import { useToast } from '../components/Toast.jsx';
import { RepeatIcon } from '../components/Icons.jsx';
import { useT } from '../lib/i18n/store.js';

// Заказы этого устройства: регистрации нет, поэтому список — просто последние ID из myOrders.js,
// живые данные по каждому подтягиваются так же, как на странице отслеживания одного заказа.
export default function MyOrders() {
  const navigate = useNavigate();
  const t = useT();
  const [toast, toastNode] = useToast();
  const STATUS_LABEL = {
    pending: t('orderStatus.pending'),
    ready: t('orderStatus.ready'),
    done: t('orderStatus.done'),
    cancelled: t('orderStatus.cancelled')
  };
  const [ids] = useState(getMyOrderIds);
  const [orders, setOrders] = useState({});

  useEffect(() => {
    const unsubs = ids.map((id) =>
      subscribeOrder(id, (o) => setOrders((prev) => ({ ...prev, [id]: o })))
    );
    return () => unsubs.forEach((stop) => stop());
  }, [ids]);

  const list = ids.map((id) => orders[id]).filter(Boolean);

  // Повтор заказа: наполняем корзину тем же составом и уводим в меню заведения.
  // Если в корзине уже лежит другое заведение — сначала спрашиваем, иначе человек
  // потеряет собранный заказ молча.
  function repeat(order) {
    const cart = useCart.getState();
    const hasOther =
      cart.restaurantId &&
      cart.restaurantId !== order.restaurantId &&
      Object.keys(cart.lines).length > 0;
    if (hasOther && !window.confirm(t('myorders.repeatConfirm'))) return;

    const restored = cart.repeat(order.restaurantId, order.items);
    if (!restored) {
      toast(t('myorders.repeatEmpty'));
      return;
    }
    navigate(`/restaurant/${order.restaurantId}`);
  }

  return (
    <div className="px-4 pt-4 pb-10 min-h-dvh lg:max-w-[560px] lg:mx-auto lg:pt-10">
      {toastNode}
      <button
        type="button"
        onClick={() => navigate('/')}
        aria-label={t('menu.back')}
        className="w-11 h-11 rounded-full bg-paper flex items-center justify-center font-bold"
      >
        ←
      </button>
      <h1 className="text-2xl lg:text-3xl font-extrabold text-ink mt-4">{t('myorders.heading')}</h1>
      <p className="text-muted text-sm mt-1">{t('myorders.subtitle')}</p>

      {list.length === 0 && (
        <div className="mt-10 text-center text-muted text-sm">
          {t('myorders.empty')}
          <Link to="/" className="block mt-3 font-bold text-accent-dark">
            {t('myorders.toRestaurants')}
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-3 mt-6">
        {list.map((order) => (
          <div key={order.id} className="bg-card rounded-xl2 border border-line p-4">
            <Link to={`/order/${order.id}`} className="block">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-muted">
                    {restaurantById[order.restaurantId]?.name}
                  </div>
                  <div className="text-2xl font-extrabold text-ink mt-0.5">{order.code}</div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-paper text-muted shrink-0">
                  {STATUS_LABEL[order.status] || order.status}
                </span>
              </div>
              <div className="flex justify-between text-sm text-muted mt-2">
                <span>{t('myorders.pickupAt', { time: formatClock(order.pickupAt) })}</span>
                <span>{formatMoney(order.total)}</span>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => repeat(order)}
              className="mt-3 flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl bg-paper px-4 text-sm font-bold text-ink transition-colors hover:bg-line"
            >
              <RepeatIcon className="w-4 h-4" />
              {t('myorders.repeat')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
