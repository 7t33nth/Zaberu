// Тесты на сами правила безопасности Firestore — против настоящего эмулятора, а не
// пересказ правил в комментариях. Запускать через `npm run test:rules` (поднимает
// эмулятор через `firebase emulators:exec`); в обычный `npm test` не входит, так как
// требует запущенного эмулятора (Java) и работает заметно медленнее.
import { after, before, beforeEach, test } from 'node:test';
import fs from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

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
  await assertSucceeds(updateDoc(doc(db, 'orders', 'o1'), { status: 'ready', readyAt: Date.now() }));
});

test('staff for r01 cannot touch another restaurant\'s order', async () => {
  const db = ctxFor('staffA@example.com');
  await assertFails(updateDoc(doc(db, 'orders', 'o2'), { status: 'ready', readyAt: Date.now() }));
});

test('wildcard staff can list and update any restaurant', async () => {
  const db = ctxFor('admin@example.com');
  const q = query(collection(db, 'orders'), where('restaurantId', 'in', ['r01', 'r02']));
  await assertSucceeds(getDocs(q));
  await assertSucceeds(updateDoc(doc(db, 'orders', 'o2'), { status: 'ready', readyAt: Date.now() }));
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

test('staff cannot read someone else\'s staff doc', async () => {
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

test('anyone can write a well-shaped days doc', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(setDoc(doc(db, 'days', 'r01_20260101'), { seq: 1, slots: { '123': 2 } }));
});

test('days doc write rejects unexpected fields', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, 'days', 'r01_20260102'), { seq: 1, slots: {}, extra: true }));
});

test('days doc write rejects a negative seq', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, 'days', 'r01_20260103'), { seq: -1, slots: {} }));
});
