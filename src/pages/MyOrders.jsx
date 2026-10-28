import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { subscribeOrder } from '../lib/api.js';
import { getMyOrderIds } from '../lib/myOrders.js';
import { restaurantById } from '../data/index.js';
import { formatClock, formatMoney } from '../lib/time.js';
import { useT } from '../lib/i18n/store.js';

// Заказы этого устройства: регистрации нет, поэтому список — просто последние ID из myOrders.js,
// живые данные по каждому подтягиваются так же, как на странице отслеживания одного заказа.
export default function MyOrders() {
  const navigate = useNavigate();
  const t = useT();
  const STATUS_LABEL = {
    pending: t('orderStatus.pending'),
    ready: t('orderStatus.ready'),
    done: t('orderStatus.done'),
    cancelled: t('orderStatus.cancelled')
  };
  const [ids] = useState(getMyOrderIds);
  const [orders, setOrders] = useState({});

  useEffect(() => {
    const unsubs = ids.map((id) => subscribeOrder(id, (o) => setOrders((prev) => ({ ...prev, [id]: o }))));
    return () => unsubs.forEach((stop) => stop());
  }, [ids]);

  const list = ids.map((id) => orders[id]).filter(Boolean);

  return (
    <div className="px-4 pt-4 pb-10 min-h-screen lg:max-w-[560px] lg:mx-auto lg:pt-10">
      <button
        type="button"
        onClick={() => navigate('/')}
        aria-label={t('menu.back')}
        className="w-9 h-9 rounded-full bg-paper flex items-center justify-center font-bold"
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
          <Link
            key={order.id}
            to={`/order/${order.id}`}
            className="block bg-card rounded-xl2 border border-line p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs text-muted">{restaurantById[order.restaurantId]?.name}</div>
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
        ))}
      </div>
    </div>
  );
}
