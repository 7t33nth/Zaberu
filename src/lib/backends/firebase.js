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
// Ограничение оператора `in` — 30 значений (проверено на эмуляторе); заведений в каталоге 18.
// ВАЖНО: два фильтра `in` перемножаются в дизъюнкции (18 заведений × 2 статуса = 36 > 30),
// поэтому «активные» заказы читаются отдельными запросами по одному статусу.
export function subscribeOrders(restaurantIds, cb) {
  return subscribeWithDayRollover(() => {
    // Кухне нужны две разные выборки:
    //  1) незавершённые заказы — независимо от даты создания. Фильтр «createdAt >= начало
    //     сегодняшнего дня» иначе уносит с экрана заказ, оформленный в 23:59 и ещё не выданный;
    //  2) всё, что создано сегодня — для истории выдач и метрик.
    const queries = [
      query(
        collection(db, 'orders'),
        where('createdAt', '>=', startOfDay()),
        where('restaurantId', 'in', restaurantIds)
      ),
      query(
        collection(db, 'orders'),
        where('restaurantId', 'in', restaurantIds),
        where('status', '==', 'pending')
      ),
      query(
        collection(db, 'orders'),
        where('restaurantId', 'in', restaurantIds),
        where('status', '==', 'ready')
      )
    ];

    const lists = queries.map(() => []);
    let reported = 0;

    // Отдаём данные только когда ответили все запросы: иначе экран на секунду показывает
    // неполный список (сначала «сегодня», потом активные) и колонки прыгают.
    const emit = () => {
      const merged = new Map();
      for (const list of lists) for (const order of list) merged.set(order.id, order);
      cb([...merged.values()]);
    };

    const stops = queries.map((q, i) => {
      let first = true;
      const settle = () => {
        if (first) {
          first = false;
          reported += 1;
        }
        if (reported === queries.length) emit();
      };
      return onSnapshot(
        q,
        (snap) => {
          lists[i] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          settle();
        },
        (err) => {
          // Без индекса или при отказе правил показываем то, что успели получить,
          // вместо пустого экрана.
          console.error('orders subscription failed', err);
          settle();
        }
      );
    });

    return () => stops.forEach((stop) => stop());
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

// Отмена заказа — клиентом (в течение минуты, это проверяют правила) или сотрудником
// кухни. Слот освобождается в той же транзакции: счётчик занятости и статус заказа
// не должны разъезжаться, иначе «отменённый» заказ навсегда держит место в слоте.
// allowReady — отмена уже готового заказа (гость не пришёл); правила Firestore разрешают
// это только сотруднику, поэтому клиентский вызов оставляет флаг выключенным.
export async function cancelOrder(id, { allowReady = false } = {}) {
  const orderRef = doc(db, 'orders', id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists()) return;
    const order = snap.data();
    const cancellable = order.status === 'pending' || (allowReady && order.status === 'ready');
    if (!cancellable) return;

    const ref = dayRef(order.restaurantId, order.pickupAt);
    const daySnap = await tx.get(ref);
    const slotKey = String(order.pickupAt);

    tx.update(orderRef, { status: 'cancelled' });
    // Если документа дня нет (например, его почистили вручную), писать в days нечего:
    // создать его здесь нельзя — правила разрешают create только с seq = 1 и одним слотом
    // (то есть первого заказа дня). Слота тоже нет, так что и освобождать нечего.
    if (daySnap.exists()) {
      const used = daySnap.data().slots?.[slotKey] || 0;
      tx.set(ref, { slots: { [slotKey]: Math.max(0, used - order.units) } }, { merge: true });
    }
  });
}

// Переход статуса только из ожидаемого состояния. Без этого кухня могла «воскресить»
// отменённый заказ: markReady перезаписал бы cancelled на ready, а слот уже освобождён.
export async function transitionOrder(id, from, patch) {
  return runTransaction(db, async (tx) => {
    const ref = doc(db, 'orders', id);
    const snap = await tx.get(ref);
    if (!snap.exists() || snap.data().status !== from) return false;
    tx.update(ref, patch);
    return true;
  });
}

export async function resetAll() {
  throw new Error('Сброс недоступен для общей базы');
}

export async function clearDoneOrders() {
  throw new Error('Сброс недоступен для общей базы');
}
