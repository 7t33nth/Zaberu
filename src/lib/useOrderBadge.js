import { useEffect, useState } from 'react';
import { subscribeOrder } from './api.js';
import { getMyOrderIds, MY_ORDERS_EVENT } from './myOrders.js';
import { clearAppBadge, setAppBadge } from './notify.js';

// Бейдж на иконке установленного приложения: столько заказов уже готовы к выдаче.
// Смысл — не «сколько всего заказов», а «сколько ждут вашего действия»: пока заказ
// готовится, дёргать человека незачем. Как только кухня отмечает выдачу (done) или
// заказ отменён, счётчик уменьшается сам — подписка на каждый заказ живая.
export function useOrderBadge() {
  const [ids, setIds] = useState(getMyOrderIds);

  useEffect(() => {
    const refresh = () => setIds(getMyOrderIds());
    window.addEventListener(MY_ORDERS_EVENT, refresh);
    return () => window.removeEventListener(MY_ORDERS_EVENT, refresh);
  }, []);

  useEffect(() => {
    if (!ids.length) {
      clearAppBadge();
      return undefined;
    }
    const statuses = new Map();
    const sync = () => {
      let ready = 0;
      for (const status of statuses.values()) if (status === 'ready') ready += 1;
      setAppBadge(ready);
    };
    const unsubs = ids.map((id) =>
      subscribeOrder(id, (order) => {
        statuses.set(id, order?.status || 'missing');
        sync();
      })
    );
    return () => {
      unsubs.forEach((stop) => stop());
      clearAppBadge();
    };
  }, [ids]);
}
