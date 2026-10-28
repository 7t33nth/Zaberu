// Общая база Firestore: клиенты и кухня на разных устройствах.
// Включается, когда заданы VITE_FIREBASE_* (см. .env.example).
// Занятость слотов хранится в документе days/{restaurantId}_{yyyymmdd} и меняется только
// в транзакции, поэтому два клиента не смогут занять один и тот же слот сверх лимита.
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  query,
  runTransaction,
  updateDoc,
  where
} from 'firebase/firestore';
import { firebaseApp } from '../firebaseApp.js';
import { SlotFullError } from '../errors.js';
import { dayKey, startOfDay } from '../time.js';
import { subscribeWithDayRollover } from '../dayRollover.js';

const db = getFirestore(firebaseApp);

export const name = 'firebase';

const dayRef = (restaurantId, ms = Date.now()) => doc(db, 'days', `${restaurantId}_${dayKey(ms)}`);

// restaurantIds — список заведений, доступных вошедшему сотруднику (см. firestore.rules:
// allow list требует, чтобы запрос был ограничен по restaurantId, иначе Firestore его отклонит).
// Ограничение оператора `in` — 30 значений (проверено на эмуляторе); заведений в каталоге 18,
// то есть запас есть. Если их станет больше 30, запрос придётся разбивать на части, иначе
// кухня с доступом "*" получит invalid-argument и останется с пустым экраном.
export function subscribeOrders(restaurantIds, cb) {
  return subscribeWithDayRollover(() => {
    const q = query(
      collection(db, 'orders'),
      where('createdAt', '>=', startOfDay()),
      where('restaurantId', 'in', restaurantIds)
    );
    return onSnapshot(
      q,
      (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error('orders subscription failed', err)
    );
  });
}

export function subscribeOrder(id, cb) {
  return onSnapshot(
    doc(db, 'orders', id),
    (snap) => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    (err) => {
      console.error('order subscription failed', err);
      cb(null);
    }
  );
}

export function subscribeSlots(restaurantId, cb) {
  // dayRef() без второго аргумента считает сегодняшнюю дату — при пересоздании подписки
  // после полуночи она пересчитается сама.
  return subscribeWithDayRollover(() =>
    onSnapshot(
      dayRef(restaurantId),
      (snap) => {
        const raw = snap.exists() ? snap.data().slots || {} : {};
        const loads = {};
        for (const [k, v] of Object.entries(raw)) loads[Number(k)] = v;
        cb(loads);
      },
      (err) => console.error('slots subscription failed', err)
    )
  );
}

export async function placeOrder(order, { capacity, codePrefix }) {
  const orderRef = doc(collection(db, 'orders'));
  const ref = dayRef(order.restaurantId, order.pickupAt);
  const slotKey = String(order.pickupAt);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const used = data.slots?.[slotKey] || 0;
    if (used + order.units > capacity) throw new SlotFullError();

    const seq = (data.seq || 0) + 1;
    const saved = {
      ...order,
      code: `${codePrefix}-${String(seq).padStart(3, '0')}`,
      status: 'pending',
      createdAt: Date.now()
    };
    tx.set(orderRef, saved);
    tx.set(ref, { seq, slots: { [slotKey]: used + order.units } }, { merge: true });
    return { id: orderRef.id, ...saved };
  });
}

export async function updateOrder(id, patch) {
  await updateDoc(doc(db, 'orders', id), patch);
}

// Отмена клиентом в течение минуты после оформления (см. firestore.rules) — заодно
// освобождаем занятый слот, иначе счётчик занятости остался бы завышен навсегда.
export async function cancelOrder(id) {
  const orderRef = doc(db, 'orders', id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists()) return;
    const order = snap.data();
    if (order.status !== 'pending') return;

    const ref = dayRef(order.restaurantId, order.pickupAt);
    const daySnap = await tx.get(ref);
    const slotKey = String(order.pickupAt);
    const used = daySnap.exists() ? daySnap.data().slots?.[slotKey] || 0 : 0;

    tx.update(orderRef, { status: 'cancelled' });
    tx.set(ref, { slots: { [slotKey]: Math.max(0, used - order.units) } }, { merge: true });
  });
}

export async function resetAll() {
  throw new Error('Сброс недоступен для общей базы');
}

export async function clearDoneOrders() {
  throw new Error('Сброс недоступен для общей базы');
}
