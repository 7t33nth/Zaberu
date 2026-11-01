// Автономный бэкенд: данные лежат в localStorage, вкладки/окна одного браузера
// синхронизируются через BroadcastChannel и событие storage. Работает без интернета и без настройки.
import { SlotFullError } from '../errors.js';
import { CANCEL_WINDOW_MS, dayKey, startOfDay } from '../time.js';
import { subscribeWithDayRollover } from '../dayRollover.js';

const KEY = 'ep_db_v1';
const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;

const listeners = new Set();
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ep_db') : null;

const fresh = () => ({ orders: {}, seq: {} });

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    return raw && raw.orders ? raw : fresh();
  } catch {
    return fresh();
  }
}

function notify() {
  listeners.forEach((fn) => fn());
}

function write(db) {
  const cutoff = Date.now() - TWO_DAYS;
  for (const [id, o] of Object.entries(db.orders)) {
    if (o.createdAt < cutoff) delete db.orders[id];
  }
  localStorage.setItem(KEY, JSON.stringify(db));
  notify();
  channel?.postMessage('changed');
}

if (channel) {
  channel.onmessage = notify;
  channel.unref?.(); // только Node: не держим процесс (тесты)
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) notify();
  });
}

function subscribe(compute, cb) {
  const run = () => cb(compute(read()));
  listeners.add(run);
  run();
  return () => listeners.delete(run);
}

const newId = () => `o_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const isToday = (o) => o.createdAt >= startOfDay();

export const name = 'local';

export function subscribeOrders(restaurantIds, cb) {
  // Без пересоздания подписки фильтр isToday() остался бы вчерашним до следующей записи.
  return subscribeWithDayRollover(() =>
    subscribe(
      (db) =>
        Object.values(db.orders).filter(
          (o) =>
            restaurantIds.includes(o.restaurantId) &&
            // Незавершённые заказы показываем всегда, даже если они оформлены вчера:
            // иначе в полночь они исчезают с экрана кухни, хотя ещё не выданы.
            (isToday(o) || o.status === 'pending' || o.status === 'cooking' || o.status === 'ready')
        ),
      cb
    )
  );
}

export function subscribeOrder(id, cb) {
  return subscribe((db) => db.orders[id] || null, cb);
}

// { [slotStartMs]: занятые порции } для заведения. Включаем не только сегодняшние
// заказы, но и предзаказы на следующие дни — иначе в чекауте закрытого заведения
// все будущие слоты выглядели бы свободными.
export function subscribeSlots(restaurantId, cb) {
  return subscribeWithDayRollover(() =>
    subscribe((db) => {
      const from = startOfDay();
      const loads = {};
      for (const o of Object.values(db.orders)) {
        if (o.restaurantId !== restaurantId || o.status === 'cancelled' || o.pickupAt < from)
          continue;
        loads[o.pickupAt] = (loads[o.pickupAt] || 0) + o.units;
      }
      return loads;
    }, cb)
  );
}

export async function placeOrder(order, { capacity, codePrefix }) {
  const db = read();
  const used = Object.values(db.orders)
    .filter(
      (o) =>
        o.restaurantId === order.restaurantId &&
        o.pickupAt === order.pickupAt &&
        o.status !== 'cancelled'
    )
    .reduce((s, o) => s + o.units, 0);
  if (used + order.units > capacity) throw new SlotFullError();

  const seqKey = `${order.restaurantId}_${dayKey(order.pickupAt)}`;
  const seq = (db.seq[seqKey] || 0) + 1;
  db.seq[seqKey] = seq;

  const id = newId();
  const saved = {
    ...order,
    id,
    code: `${codePrefix}-${String(seq).padStart(3, '0')}`,
    status: 'pending',
    createdAt: Date.now()
  };
  db.orders[id] = saved;
  write(db);
  return saved;
}

export async function updateOrder(id, patch) {
  const db = read();
  if (!db.orders[id]) return;
  db.orders[id] = { ...db.orders[id], ...patch };
  write(db);
}

// Переход статуса только из ожидаемого состояния (см. transitionOrder в firebase.js).
export async function transitionOrder(id, from, patch) {
  const db = read();
  if (db.orders[id]?.status !== from) return false;
  db.orders[id] = { ...db.orders[id], ...patch };
  write(db);
  return true;
}

// Отмена клиентом или кухней — слот освобождается сам собой, так как занятость здесь
// всегда считается заново по живым заказам (см. subscribeSlots).
// by/reason нужны клиенту, чтобы показать причину отмены: «Вы отменили заказ» или
// текст, который ввёл сотрудник. Окно самостоятельной отмены — CANCEL_WINDOW_MS.
export async function cancelOrder(id, { allowReady = false, by = 'customer', reason = '' } = {}) {
  const db = read();
  const order = db.orders[id];
  const status = order?.status;
  // Кухня может снять заказ на любом этапе — в том числе уже готовящийся,
  // если ингредиенты закончились. Клиент — только свежий pending или готовый
  // (последнее разрешено лишь вызывающему с allowReady).
  const cancellable =
    status === 'pending' ||
    (allowReady && status === 'ready') ||
    (by === 'staff' && status === 'cooking');
  if (!cancellable) return false;
  if (
    by === 'customer' &&
    status === 'pending' &&
    Date.now() > (order.createdAt || 0) + CANCEL_WINDOW_MS
  ) {
    return false;
  }

  // cancelledFrom нужен прогресс-бару: красный крестик ставится на тот шаг,
  // в котором заказ был в момент отмены, а cancelledAt — окну 30-минутного показа.
  const patch = {
    status: 'cancelled',
    cancelledBy: by,
    cancelledAt: Date.now(),
    cancelledFrom: status
  };
  if (by === 'staff')
    patch.cancelReason = String(reason || '')
      .trim()
      .slice(0, 200);

  db.orders[id] = { ...order, ...patch };
  write(db);
  return true;
}

export async function resetAll() {
  write(fresh());
}

// Чистит только "выданные"/отменённые заказы этого заведения (историю, влияющую на метрики).
// Текущую очередь (pending/ready) и другие заведения не трогает.
export async function clearDoneOrders(restaurantId) {
  const db = read();
  for (const [id, o] of Object.entries(db.orders)) {
    if (o.restaurantId === restaurantId && (o.status === 'done' || o.status === 'cancelled')) {
      delete db.orders[id];
    }
  }
  write(db);
}
