import test from 'node:test';
import assert from 'node:assert/strict';

// минимальная замена localStorage для Node
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k)
};

const local = await import('../src/lib/backends/local.js');
const { SlotFullError } = await import('../src/lib/errors.js');
const { computeMetrics, waitMs } = await import('../src/lib/metrics.js');
const { ceilToSlot, SLOT_MS } = await import('../src/lib/time.js');

const base = (over = {}) => ({
  restaurantId: 'r01',
  items: [{ id: 'r01-001', name: 'Бургер', qty: 2, price: 2490 }],
  units: 2,
  total: 4980,
  pickupAt: ceilToSlot(Date.now() + 20 * 60000),
  name: '',
  pay: 'online',
  ...over
});
const opts = { capacity: 5, codePrefix: 'B' };

test('слот нельзя переполнить: третий заказ на 2 порции не проходит при лимите 5', async () => {
  await local.resetAll();
  const a = await local.placeOrder(base(), opts);
  const b = await local.placeOrder(base(), opts);
  assert.equal(a.code, 'B-001');
  assert.equal(b.code, 'B-002');
  await assert.rejects(() => local.placeOrder(base(), opts), SlotFullError);
  // но в соседний слот заказ проходит
  const c = await local.placeOrder(base({ pickupAt: base().pickupAt + SLOT_MS }), opts);
  assert.equal(c.code, 'B-003');
});

test('подписка на слоты видит занятость и обновляется', async () => {
  await local.resetAll();
  const seen = [];
  const stop = local.subscribeSlots('r01', (loads) => seen.push(loads));
  const o = base();
  await local.placeOrder(o, opts);
  stop();
  assert.deepEqual(seen[0], {});
  assert.equal(seen.at(-1)[o.pickupAt], 2);
});

test('статусы и метрики ожидания', async () => {
  await local.resetAll();
  const now = Date.now();
  const o = await local.placeOrder(base({ pickupAt: ceilToSlot(now) }), opts);
  await local.updateOrder(o.id, { status: 'ready', readyAt: now });
  await local.updateOrder(o.id, { arrivedAt: now + 10_000 });
  await local.updateOrder(o.id, { status: 'done', issuedAt: now + 70_000 });
  let orders;
  local.subscribeOrders(['r01'], (x) => (orders = x))();
  const done = orders.find((x) => x.id === o.id);
  assert.equal(waitMs(done), 60_000);
  const m = computeMetrics(orders, { capacity: 5, now: now + 80_000 });
  assert.equal(m.doneCount, 1);
  assert.equal(m.avgWaitMs, 60_000);
  assert.equal(m.onTargetShare, 1);
});

test('слот освобождается, если заказ отменён', async () => {
  await local.resetAll();
  const o = base();
  const a = await local.placeOrder(o, { capacity: 2, codePrefix: 'B' });
  await assert.rejects(() => local.placeOrder(o, { capacity: 2, codePrefix: 'B' }), SlotFullError);
  await local.updateOrder(a.id, { status: 'cancelled' });
  await local.placeOrder(o, { capacity: 2, codePrefix: 'B' });
});
