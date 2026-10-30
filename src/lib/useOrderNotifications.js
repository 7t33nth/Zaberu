import { useEffect, useRef, useState } from 'react';
import { subscribeOrder } from './api.js';
import { getMyOrderIds, MY_ORDERS_EVENT } from './myOrders.js';
import { clearAppBadge, notifyIfHidden, setAppBadge } from './notify.js';
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

  useEffect(() => {
    const refresh = () => setIds(getMyOrderIds());
    window.addEventListener(MY_ORDERS_EVENT, refresh);
    return () => window.removeEventListener(MY_ORDERS_EVENT, refresh);
  }, []);

  useEffect(() => {
    if (!ids.length) {
      statuses.current.clear();
      clearAppBadge();
      return undefined;
    }

    // Убираем из памяти заказы, которых больше нет в локальном списке.
    const current = new Set(ids);
    for (const id of statuses.current.keys()) {
      if (!current.has(id)) statuses.current.delete(id);
    }

    const syncBadge = () => {
      let ready = 0;
      for (const id of ids) if (statuses.current.get(id) === 'ready') ready += 1;
      setAppBadge(ready);
    };

    const unsubs = ids.map((id) =>
      subscribeOrder(id, (order) => {
        const nextStatus = order?.status || 'missing';
        const prevStatus = statuses.current.get(id);
        statuses.current.set(id, nextStatus);
        syncBadge();

        // Уведомляем только на переходе в ready, а не на первом снапшоте уже готового
        // заказа: иначе каждый запуск приложения показывал бы старое «готово».
        if (prevStatus && prevStatus !== 'ready' && nextStatus === 'ready') {
          const text = t('order.toastReady');
          if (document.visibilityState === 'visible') onToast?.(text);
          else notifyIfHidden(text, order.code);
        }
      })
    );

    return () => {
      unsubs.forEach((stop) => stop());
      clearAppBadge();
    };
  }, [ids, onToast, t]);
}
