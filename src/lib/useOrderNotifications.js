import { useEffect, useRef, useState } from 'react';
import { autoCancelExpiredOrder, subscribeOrder } from './api.js';
import { getMyOrderIds, markOrderAttention, MY_ORDERS_EVENT } from './myOrders.js';
import { clearAppBadge, notifyIfHidden, setAppBadge } from './notify.js';
import { RECEIVE_GRACE_MS } from './time.js';
import { useT } from './i18n/store.js';

// Глобальный watcher «моих заказов»: badge на иконке и уведомление о готовности.
// В отличие от страницы трекинга, живёт на уровне App, поэтому ловит смену статуса
// на любом экране. Это по-прежнему не Web Push: при полностью закрытом приложении
// слушать Firestore некому — для этого нужен сервер, отправляющий push.
export function useOrderNotifications(onToast) {
  const t = useT();
  const [ids, setIds] = useState(getMyOrderIds);
  // Статусы переживают пересоздание подписок (смена списка заказов, языка и т.п.),
  // иначе первый снапшот после переподписки выглядел бы как новая смена статуса.
  const statuses = useRef(new Map());
  const orders = useRef(new Map());
  // Не отправляем повторную отмену, пока предыдущая ещё в пути.
  const expiring = useRef(new Set());

  useEffect(() => {
    const refresh = () => setIds(getMyOrderIds());
    window.addEventListener(MY_ORDERS_EVENT, refresh);
    return () => window.removeEventListener(MY_ORDERS_EVENT, refresh);
  }, []);

  useEffect(() => {
    if (!ids.length) {
      statuses.current.clear();
      orders.current.clear();
      clearAppBadge();
      return undefined;
    }

    // Убираем из памяти заказы, которых больше нет в локальном списке.
    const current = new Set(ids);
    for (const id of statuses.current.keys()) {
      if (!current.has(id)) {
        statuses.current.delete(id);
        orders.current.delete(id);
      }
    }

    const syncBadge = () => {
      let ready = 0;
      for (const id of ids) if (statuses.current.get(id) === 'ready') ready += 1;
      setAppBadge(ready);
    };

    // Готовый заказ, который не забрали за отведённые 3 часа, отменяем автоматически.
    // В local-бэкенде это делает эта же вкладка; в Firestore — любой открытый клиент,
    // а правила разрешают такой переход только после истечения срока.
    const expireIfNeeded = (id) => {
      const order = orders.current.get(id);
      if (!order || order.status !== 'ready' || order.receivedAt) return;
      const readyAt = order.readyAt || order.pickupAt || 0;
      if (!readyAt || Date.now() < readyAt + RECEIVE_GRACE_MS) return;
      if (expiring.current.has(id)) return;

      expiring.current.add(id);
      autoCancelExpiredOrder(id)
        .then((ok) => {
          // Индикатор у «Истории заказов»: человек должен увидеть, что случилось,
          // даже если приложение было закрыто и он не нажимал «Понял(а)».
          if (ok) markOrderAttention(id);
        })
        .catch((err) => console.error('auto-cancel failed', err))
        .finally(() => expiring.current.delete(id));
    };

    const unsubs = ids.map((id) =>
      subscribeOrder(id, (order) => {
        if (order) orders.current.set(id, order);
        else orders.current.delete(id);

        const nextStatus = order?.status || 'missing';
        const prevStatus = statuses.current.get(id);
        statuses.current.set(id, nextStatus);
        syncBadge();
        expireIfNeeded(id);

        // Уведомляем только на переходе в ready, а не на первом снапшоте уже готового
        // заказа: иначе каждый запуск приложения показывал бы старое «готово».
        if (prevStatus && prevStatus !== 'ready' && nextStatus === 'ready') {
          const text = t('order.toastReady');
          if (document.visibilityState === 'visible') onToast?.(text);
          else notifyIfHidden(text, order.code);
        }
      })
    );

    // Снапшот не приходит, пока ничего не меняется, поэтому раз в минуту проверяем
    // сроки сами — иначе заказ «завис» бы в ready до следующего действия кухни.
    const timer = setInterval(() => ids.forEach(expireIfNeeded), 60 * 1000);

    return () => {
      clearInterval(timer);
      unsubs.forEach((stop) => stop());
      clearAppBadge();
    };
  }, [ids, onToast, t]);
}
