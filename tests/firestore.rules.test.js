// Тесты на сами правила безопасности Firestore — против настоящего эмулятора, а не
// пересказ правил в комментариях. Запускать через `npm run test:rules` (поднимает
// эмулятор через `firebase emulators:exec`); в обычный `npm test` не входит, так как
// требует запущенного эмулятора (Java) и работает заметно медленнее.
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';

let testEnv;

const soon = () => Date.now() + 10 * 60000;

async function seed(fn) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'express-pickup-rules-test',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') }
  });
});

after(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(async (db) => {
    await setDoc(doc(db, 'staff', 'staffa@example.com'), { restaurantIds: ['r01'] });
    await setDoc(doc(db, 'staff', 'admin@example.com'), { restaurantIds: ['*'] });
    await setDoc(doc(db, 'orders', 'o1'), {
      restaurantId: 'r01',
      status: 'pending',
      units: 2,
      pickupAt: soon(),
      createdAt: Date.now()
    });
    await setDoc(doc(db, 'orders', 'o2'), {
      restaurantId: 'r02',
      status: 'pending',
      units: 2,
      pickupAt: soon(),
      createdAt: Date.now()
    });
  });
});

function ctxFor(email) {
  return testEnv.authenticatedContext(email, { email }).firestore();
}

// --- orders: cross-tenant scoping (regression test for the leak this session fixed) ---

test('staff for r01 can list r01 orders', async () => {
  const db = ctxFor('staffA@example.com');
  const q = query(collection(db, 'orders'), where('restaurantId', 'in', ['r01']));
  await assertSucceeds(getDocs(q));
});

test('staff for r01 cannot list r02 orders', async () => {
  const db = ctxFor('staffA@example.com');
  const q = query(collection(db, 'orders'), where('restaurantId', 'in', ['r02']));
  await assertFails(getDocs(q));
});

test('unauthenticated cannot list orders at all', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  const q = query(collection(db, 'orders'), where('restaurantId', 'in', ['r01']));
  await assertFails(getDocs(q));
});

test('staff for r01 can mark their own order ready', async () => {
  const db = ctxFor('staffA@example.com');
  await assertSucceeds(
    updateDoc(doc(db, 'orders', 'o1'), { status: 'ready', readyAt: Date.now() })
  );
});

test('staff can cancel a ready order (the app frees its slot in the same transaction)', async () => {
  await seed(async (db) =>
    setDoc(doc(db, 'orders', 'ready2'), {
      restaurantId: 'r01',
      status: 'ready',
      units: 1,
      pickupAt: soon(),
      createdAt: Date.now()
    })
  );
  const db = ctxFor('staffA@example.com');
  await assertSucceeds(updateDoc(doc(db, 'orders', 'ready2'), { status: 'cancelled' }));
});

test("staff for r01 cannot touch another restaurant's order", async () => {
  const db = ctxFor('staffA@example.com');
  await assertFails(updateDoc(doc(db, 'orders', 'o2'), { status: 'ready', readyAt: Date.now() }));
});

test('wildcard staff can list and update any restaurant', async () => {
  const db = ctxFor('admin@example.com');
  const q = query(collection(db, 'orders'), where('restaurantId', 'in', ['r01', 'r02']));
  await assertSucceeds(getDocs(q));
  await assertSucceeds(
    updateDoc(doc(db, 'orders', 'o2'), { status: 'ready', readyAt: Date.now() })
  );
});

// Кухня с доступом "*" подписывается сразу на все заведения каталога. Проверено на
// эмуляторе: оператор `in` принимает до 30 значений, так что 18 заведений проходят.
// Если заведений станет больше 30, запрос придётся разбивать на части.
test('wildcard staff can list all 18 restaurants in one query', async () => {
  const db = ctxFor('admin@example.com');
  const ids = Array.from({ length: 18 }, (_, i) => `r${String(i + 1).padStart(2, '0')}`);
  const q = query(collection(db, 'orders'), where('restaurantId', 'in', ids));
  await assertSucceeds(getDocs(q));
});

// «Активные» заказы читаются двумя запросами: `in` по 18 заведениям и `==` по статусу.
// Два фильтра `in` дали бы 36 дизъюнкций и были бы отклонены (лимит 30).
test('wildcard staff can list pending and ready orders across 18 restaurants', async () => {
  const db = ctxFor('admin@example.com');
  const ids = Array.from({ length: 18 }, (_, i) => `r${String(i + 1).padStart(2, '0')}`);
  for (const status of ['pending', 'ready']) {
    const q = query(
      collection(db, 'orders'),
      where('restaurantId', 'in', ids),
      where('status', '==', status)
    );
    await assertSucceeds(getDocs(q));
  }
});

// --- orders: create ---

test('unauthenticated can create a well-formed pending order', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(
    setDoc(doc(db, 'orders', 'new1'), {
      restaurantId: 'r01',
      status: 'pending',
      units: 2,
      pickupAt: soon(),
      createdAt: Date.now()
    })
  );
});

test('cannot create an order with readyAt pre-set (status spoofing)', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(
    setDoc(doc(db, 'orders', 'new2'), {
      restaurantId: 'r01',
      status: 'pending',
      units: 2,
      pickupAt: soon(),
      createdAt: Date.now(),
      readyAt: Date.now()
    })
  );
});

test('cannot create an order with units over the cap', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(
    setDoc(doc(db, 'orders', 'new3'), {
      restaurantId: 'r01',
      status: 'pending',
      units: 31,
      pickupAt: soon(),
      createdAt: Date.now()
    })
  );
});

// --- orders: unauthenticated update paths (arrival + self-cancel) ---

test('unauthenticated can mark arrivedAt with a numeric timestamp', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(updateDoc(doc(db, 'orders', 'o1'), { arrivedAt: Date.now() }));
});

test('unauthenticated cannot set arrivedAt to a non-number', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(updateDoc(doc(db, 'orders', 'o1'), { arrivedAt: 'now' }));
});

test('unauthenticated cannot change status directly to ready/done', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(updateDoc(doc(db, 'orders', 'o1'), { status: 'done' }));
});

// --- orders: подтверждение получения и запрет «выдано» в одностороннем порядке ---

const readyOrder = (overrides = {}) => ({
  restaurantId: 'r01',
  status: 'ready',
  units: 1,
  pickupAt: soon(),
  readyAt: Date.now(),
  createdAt: Date.now(),
  ...overrides
});

test('unauthenticated can confirm receipt of a ready order', async () => {
  await seed(async (db) => setDoc(doc(db, 'orders', 'rc1'), readyOrder()));
  const db = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(updateDoc(doc(db, 'orders', 'rc1'), { receivedAt: Date.now() }));
});

test('unauthenticated cannot confirm receipt of an order that is not ready yet', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(updateDoc(doc(db, 'orders', 'o1'), { receivedAt: Date.now() }));
});

test('confirming receipt cannot also change the status', async () => {
  await seed(async (db) => setDoc(doc(db, 'orders', 'rc2'), readyOrder()));
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(
    updateDoc(doc(db, 'orders', 'rc2'), { receivedAt: Date.now(), status: 'done' })
  );
});

test('staff cannot mark an order done before the customer confirms', async () => {
  await seed(async (db) => setDoc(doc(db, 'orders', 'rc3'), readyOrder()));
  const db = ctxFor('staffA@example.com');
  await assertFails(updateDoc(doc(db, 'orders', 'rc3'), { status: 'done', issuedAt: Date.now() }));
});

test('staff can mark an order done once the customer confirmed', async () => {
  await seed(async (db) =>
    setDoc(doc(db, 'orders', 'rc4'), readyOrder({ receivedAt: Date.now() }))
  );
  const db = ctxFor('staffA@example.com');
  await assertSucceeds(
    updateDoc(doc(db, 'orders', 'rc4'), { status: 'done', issuedAt: Date.now() })
  );
});

test('staff can close an unconfirmed order 3 hours after the pickup time', async () => {
  await seed(async (db) =>
    setDoc(doc(db, 'orders', 'rc5'), readyOrder({ pickupAt: Date.now() - 4 * 60 * 60 * 1000 }))
  );
  const db = ctxFor('staffA@example.com');
  await assertSucceeds(
    updateDoc(doc(db, 'orders', 'rc5'), { status: 'done', issuedAt: Date.now() })
  );
});

test('cannot create an order with receivedAt pre-set', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(
    setDoc(doc(db, 'orders', 'rc6'), {
      restaurantId: 'r01',
      status: 'pending',
      units: 1,
      pickupAt: soon(),
      createdAt: Date.now(),
      receivedAt: Date.now()
    })
  );
});

test('unauthenticated can self-cancel a fresh pending order', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(updateDoc(doc(db, 'orders', 'o1'), { status: 'cancelled' }));
});

test('unauthenticated cannot self-cancel an order older than the 1-minute window', async () => {
  await seed(async (db) =>
    setDoc(doc(db, 'orders', 'old'), {
      restaurantId: 'r01',
      status: 'pending',
      units: 1,
      pickupAt: soon(),
      createdAt: Date.now() - 120000
    })
  );
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(updateDoc(doc(db, 'orders', 'old'), { status: 'cancelled' }));
});

test('unauthenticated cannot cancel an order that is already ready', async () => {
  await seed(async (db) =>
    setDoc(doc(db, 'orders', 'readyOne'), {
      restaurantId: 'r01',
      status: 'ready',
      units: 1,
      pickupAt: soon(),
      createdAt: Date.now()
    })
  );
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(updateDoc(doc(db, 'orders', 'readyOne'), { status: 'cancelled' }));
});

// --- staff/{email} ---

test('staff can read their own staff doc', async () => {
  const db = ctxFor('staffA@example.com');
  await assertSucceeds(getDoc(doc(db, 'staff', 'staffa@example.com')));
});

test("staff cannot read someone else's staff doc", async () => {
  const db = ctxFor('staffA@example.com');
  await assertFails(getDoc(doc(db, 'staff', 'admin@example.com')));
});

test('email lookup is case-insensitive against the lowercase doc id', async () => {
  const db = ctxFor('StaffA@Example.com');
  await assertSucceeds(getDoc(doc(db, 'staff', 'staffa@example.com')));
});

test('clients can never write to the staff collection, even their own doc', async () => {
  const db = ctxFor('staffA@example.com');
  await assertFails(setDoc(doc(db, 'staff', 'staffa@example.com'), { restaurantIds: ['*'] }));
});

// --- days/{dayId} ---

// Первый заказ дня: seq = 1 и ровно один слот.
test('the first order of the day creates a day doc with seq 1 and one slot', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(setDoc(doc(db, 'days', 'r01_20260101'), { seq: 1, slots: { 123: 2 } }));
});

test('day create is rejected when seq is not 1', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, 'days', 'r01_20260104'), { seq: 0, slots: { 123: 2 } }));
  await assertFails(setDoc(doc(db, 'days', 'r01_20260105'), { seq: 2, slots: { 123: 2 } }));
});

test('day create is rejected with zero or several slots', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, 'days', 'r01_20260106'), { seq: 1, slots: {} }));
  await assertFails(setDoc(doc(db, 'days', 'r01_20260107'), { seq: 1, slots: { 111: 1, 222: 1 } }));
});

test('days doc write rejects unexpected fields', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, 'days', 'r01_20260102'), { seq: 1, slots: {}, extra: true }));
});

test('days doc write rejects a negative seq', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, 'days', 'r01_20260103'), { seq: -1, slots: {} }));
});

// Так cancelOrder освобождает слот: merge-запись только своего ключа, seq берётся из
// существующего документа.
test('slot decrement merges into an existing day doc and keeps seq', async () => {
  await seed(async (db) => setDoc(doc(db, 'days', 'r01_20260501'), { seq: 3, slots: { 111: 2 } }));
  const db = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(
    setDoc(doc(db, 'days', 'r01_20260501'), { slots: { 111: 1 } }, { merge: true })
  );
});

// Так placeOrder добавляет второй заказ дня: seq + 1 и ровно один новый слот.
test('a new order bumps seq by one and adds one slot', async () => {
  await seed(async (db) => setDoc(doc(db, 'days', 'r01_20260502'), { seq: 5, slots: { 111: 1 } }));
  const db = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(
    setDoc(doc(db, 'days', 'r01_20260502'), { seq: 6, slots: { 222: 1 } }, { merge: true })
  );
});

test('day update cannot reset or skip seq', async () => {
  await seed(async (db) => setDoc(doc(db, 'days', 'r01_20260503'), { seq: 5, slots: { 111: 1 } }));
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, 'days', 'r01_20260503'), { seq: 4 }, { merge: true }));
  await assertFails(setDoc(doc(db, 'days', 'r01_20260503'), { seq: 7 }, { merge: true }));
});

test('day update cannot remove a slot key', async () => {
  await seed(async (db) =>
    setDoc(doc(db, 'days', 'r01_20260504'), { seq: 5, slots: { 111: 1, 222: 1 } })
  );
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, 'days', 'r01_20260504'), { seq: 5, slots: { 111: 1 } }));
});

test('day update cannot wipe the whole slots map', async () => {
  await seed(async (db) =>
    setDoc(doc(db, 'days', 'r01_20260505'), { seq: 5, slots: { 111: 1, 222: 1 } })
  );
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, 'days', 'r01_20260505'), { seq: 5, slots: {} }));
});

test('day update cannot change two slots in one write', async () => {
  await seed(async (db) =>
    setDoc(doc(db, 'days', 'r01_20260506'), { seq: 5, slots: { 111: 1, 222: 1 } })
  );
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, 'days', 'r01_20260506'), { seq: 6, slots: { 111: 0, 222: 0 } }));
});

test('day doc cannot be deleted', async () => {
  await seed(async (db) => setDoc(doc(db, 'days', 'r01_20260507'), { seq: 1, slots: { 111: 1 } }));
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(deleteDoc(doc(db, 'days', 'r01_20260507')));
});

// Отмена заказа по недостающему документу дня больше не создаёт его: seq = 0 запрещён,
// поэтому cancelOrder просто пропускает запись в days.
test('cancel over a missing day doc cannot create one', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(
    setDoc(doc(db, 'days', 'r01_20260508'), { slots: { 111: 0 } }, { merge: true })
  );
  await assertFails(
    setDoc(doc(db, 'days', 'r01_20260509'), { seq: 0, slots: { 111: 0 } }, { merge: true })
  );
});

test('staff of the day restaurant can write its slots', async () => {
  const db = ctxFor('staffA@example.com');
  await assertSucceeds(setDoc(doc(db, 'days', 'r01_20260510'), { seq: 1, slots: { 111: 1 } }));
});

test('staff cannot write the days of another restaurant', async () => {
  const db = ctxFor('staffA@example.com');
  await assertFails(setDoc(doc(db, 'days', 'r02_20260510'), { seq: 1, slots: { 111: 1 } }));
});

test('wildcard staff can write any day doc', async () => {
  const db = ctxFor('admin@example.com');
  await assertSucceeds(setDoc(doc(db, 'days', 'r02_20260511'), { seq: 1, slots: { 111: 1 } }));
});

// Самый важный тест раздела: правила проверяются не по отдельности, а на тех же двух
// транзакциях, что делает приложение (placeOrder и cancelOrder из backends/firebase.js).
test('two orders and a cancel pass the rules end to end', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  const dayRef = doc(db, 'days', 'r01_20260512');
  const slotA = 1793000000000;
  const slotB = slotA + 300000;

  const place = (pickupAt, units, code) =>
    runTransaction(db, async (tx) => {
      const daySnap = await tx.get(dayRef);
      const data = daySnap.exists() ? daySnap.data() : {};
      const used = data.slots?.[String(pickupAt)] || 0;
      const seq = (data.seq || 0) + 1;
      const orderRef = doc(collection(db, 'orders'));
      tx.set(orderRef, {
        restaurantId: 'r01',
        status: 'pending',
        units,
        pickupAt,
        createdAt: Date.now(),
        code
      });
      tx.set(dayRef, { seq, slots: { [String(pickupAt)]: used + units } }, { merge: true });
      return orderRef.id;
    });

  const firstId = await place(slotA, 2, 'A-001');
  await place(slotB, 1, 'A-002');

  await runTransaction(db, async (tx) => {
    const orderSnap = await tx.get(doc(db, 'orders', firstId));
    const daySnap = await tx.get(dayRef);
    const used = daySnap.data().slots?.[String(slotA)] || 0;
    tx.update(doc(db, 'orders', firstId), { status: 'cancelled' });
    tx.set(
      dayRef,
      { slots: { [String(slotA)]: Math.max(0, used - orderSnap.data().units) } },
      { merge: true }
    );
  });

  const day = (await getDoc(dayRef)).data();
  assert.equal(day.seq, 2);
  assert.deepEqual(day.slots, { [String(slotA)]: 0, [String(slotB)]: 1 });
});
