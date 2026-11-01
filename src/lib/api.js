// Единая точка доступа к данным. Интерфейс одинаков для localStorage и Firebase.
import { menu, restaurantById } from '../data/index.js';
import { SLOT_MS, ceilToSlot } from './time.js';

const useFirebase = Boolean(import.meta.env.VITE_FIREBASE_PROJECT_ID);
const backendPromise = useFirebase
  ? import('./backends/firebase.js')
  : import('./backends/local.js');

export const backendName = useFirebase ? 'firebase' : 'local';
export const canReset = !useFirebase;

// Подписка, возвращающая функцию отписки сразу (бэкенд подгружается асинхронно).
function lazySubscribe(method) {
  return (...args) => {
    let stop = () => {};
    let cancelled = false;
    backendPromise.then((b) => {
      if (!cancelled) stop = b[method](...args);
    });
    return () => {
      cancelled = true;
      stop();
    };
  };
}

export const subscribeOrders = lazySubscribe('subscribeOrders');
export const subscribeOrder = lazySubscribe('subscribeOrder');
export const subscribeSlots = lazySubscribe('subscribeSlots');

export async function placeOrder({ restaurant, lines, pickupAt, name = '', comment = '', pay }) {
  const b = await backendPromise;
  const items = lines.map(({ dish, qty }) => ({
    id: dish.id,
    name: dish.name,
    qty,
    price: dish.price
  }));
  const order = {
    restaurantId: restaurant.id,
    items,
    units: items.reduce((s, i) => s + i.qty, 0),
    total: items.reduce((s, i) => s + i.qty * i.price, 0),
    pickupAt,
    name: name.trim().slice(0, 40),
    comment: comment.trim().slice(0, 140),
    pay
  };
  return b.placeOrder(order, { capacity: restaurant.slotCapacity, codePrefix: restaurant.code });
}

const patch = (id, fields) => backendPromise.then((b) => b.updateOrder(id, fields));
const transition = (id, from, fields) =>
  backendPromise
    .then((b) => b.transitionOrder(id, from, fields))
    .then((ok) => {
      if (ok === false) throw new Error('transition_failed');
      return ok;
    });

export const markCooking = (id) =>
  transition(id, 'pending', { status: 'cooking', acceptedAt: Date.now() });
export const startCooking = markCooking;
export const acceptOrder = markCooking;

export const markReady = (id) =>
  transition(id, 'cooking', { status: 'ready', readyAt: Date.now() });

export const markDone = (id) => transition(id, 'ready', { status: 'done', issuedAt: Date.now() });
export const markArrived = (id) => patch(id, { arrivedAt: Date.now() });
// Клиент подтверждает, что забрал заказ, и это сразу закрывает его: статус 'done',
// issuedAt для метрик и заполненный финальный шаг прогресс-бара. Отдельное действие
// кухни «Выдано» больше не нужно.
export const markReceived = (id) => {
  const now = Date.now();
  return backendPromise.then((b) =>
    b.transitionOrder(id, 'ready', { receivedAt: now, issuedAt: now, status: 'done' })
  );
};
// Клиентская отмена: backend сам проставляет cancelledBy/cancelReason, а правила
// Firestore дополнительно проверяют трёхминутное окно.
export const cancelOrder = (id) =>
  backendPromise.then((b) => b.cancelOrder(id, { by: 'customer' }));
// Кухня может отменить и готовый заказ (гость не пришёл) — клиенту это запрещено правилами.
// reason уходит в заказ, чтобы клиент увидел причину отмены на экране чека.
export const cancelOrderByStaff = (id, reason = '') =>
  backendPromise.then((b) => b.cancelOrder(id, { allowReady: true, by: 'staff', reason }));
// Автоматическая отмена готового заказа, который не забрали за 3 часа
// (RECEIVE_GRACE_MS). cancelledBy = 'system' — клиент увидит «Вы не забрали заказ».
export const autoCancelExpiredOrder = (id) =>
  backendPromise.then((b) => b.cancelOrder(id, { allowReady: true, by: 'system' }));
export const resetAll = () => backendPromise.then((b) => b.resetAll());
export const clearDoneOrders = (restaurantId) =>
  backendPromise.then((b) => b.clearDoneOrders(restaurantId));

// Демо-заказы для показа кухни и загрузки слотов (тот же путь, что и у настоящих заказов).
export async function seedDemoOrders(restaurantId, now = Date.now()) {
  const restaurant = restaurantById[restaurantId];
  const dishes = menu.filter((d) => d.restaurantId === restaurantId && d.available);
  const names = ['Айдар', 'Мадина', 'Данияр', 'Алия', 'Тимур', 'Асель', 'Ерлан', ''];
  const first = ceilToSlot(now + 10 * 60000);
  let created = 0;
  for (let i = 0; i < 9; i++) {
    const dish = dishes[i % dishes.length];
    const qty = 1 + (i % 3);
    const pickupAt = first + Math.floor(i / 2) * SLOT_MS;
    try {
      await placeOrder({
        restaurant,
        lines: [{ dish, qty }],
        pickupAt,
        name: names[i % names.length],
        pay: i % 2 ? 'kaspi' : 'online'
      });
      created++;
    } catch {
      // слот заполнен — пропускаем, так и должно работать
    }
  }
  return created;
}
