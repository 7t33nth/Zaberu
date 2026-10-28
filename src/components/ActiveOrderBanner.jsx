import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { subscribeOrder } from '../lib/api.js';
import { getMyOrderIds } from '../lib/myOrders.js';
import { formatClock } from '../lib/time.js';
import { restaurantById } from '../data/index.js';
import { BagIcon, ReceiptIcon } from './Icons.jsx';
import { useT } from '../lib/i18n/store.js';

// Возвращает клиента к его заказам после перезагрузки: регистрации нет, заказы помним на устройстве.
// Показываем ВСЕ ещё не выданные заказы этого устройства, а не только последний оформленный —
// иначе более ранний активный заказ из другого заведения как будто "пропадает" из виду.
export default function ActiveOrderBanner() {
  const t = useT();
  const [orders, setOrders] = useState({});

  useEffect(() => {
    const ids = getMyOrderIds();
    const unsubs = ids.map((id) =>
      subscribeOrder(id, (o) => setOrders((prev) => ({ ...prev, [id]: o })))
    );
    return () => unsubs.forEach((stop) => stop());
  }, []);

  const active = Object.values(orders)
    .filter((o) => o && o.status !== 'done' && o.status !== 'cancelled')
    .sort((a, b) => a.pickupAt - b.pickupAt);

  if (active.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mx-4 mb-4">
      {active.map((order) => {
        const ready = order.status === 'ready';
        return (
          <Link
            key={order.id}
            to={`/order/${order.id}`}
            className={`flex items-center justify-between rounded-2xl px-4 py-3 shadow-md ${
              ready ? 'bg-accent text-primary' : 'bg-brand text-white'
            }`}
          >
            <span className="flex items-center gap-3">
              <span
                className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0"
                aria-hidden="true"
              >
                {ready ? <BagIcon className="w-5 h-5" /> : <ReceiptIcon className="w-5 h-5" />}
              </span>
              <span>
                <span className="block text-xs text-white/80 font-medium">
                  {ready ? t('banner.ready') : t('banner.yourOrder')} ·{' '}
                  {restaurantById[order.restaurantId]?.name}
                </span>
                <span className="block font-extrabold text-lg">
                  {order.code} · {formatClock(order.pickupAt)}
                </span>
              </span>
            </span>
            <span className="text-sm font-bold shrink-0 underline-offset-2 hover:underline">
              {t('banner.open')}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
