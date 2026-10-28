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
  await local.cancelOrder(a.id);
  await local.placeOrder(o, { capacity: 2, codePrefix: 'B' });
});

test('кухня отменяет готовый заказ — слот освобождается', async () => {
  await local.resetAll();
  const o = base();
  const a = await local.placeOrder(o, { capacity: 2, codePrefix: 'B' });
  assert.equal(await local.transitionOrder(a.id, 'pending', { status: 'ready' }), true);

  let loads = {};
  const stop = local.subscribeSlots('r01', (x) => (loads = x));
  assert.equal(loads[o.pickupAt], 2);

  await local.cancelOrder(a.id, { allowReady: true });
  assert.equal(loads[o.pickupAt] ?? 0, 0);

  // место снова можно занять
  await local.placeOrder(o, { capacity: 2, codePrefix: 'B' });
  stop();
});

test('повторная отмена не освобождает чужое место в слоте', async () => {
  await local.resetAll();
  const o = base({ units: 1 });
  const first = await local.placeOrder(o, { capacity: 5, codePrefix: 'B' });
  await local.placeOrder(base({ units: 2 }), { capacity: 5, codePrefix: 'B' });

  let loads = {};
  const stop = local.subscribeSlots('r01', (x) => (loads = x));

  await local.cancelOrder(first.id);
  await local.cancelOrder(first.id);
  assert.equal(loads[o.pickupAt], 2);
  stop();
});

test('клиент не может отменить готовый заказ', async () => {
  await local.resetAll();
  const a = await local.placeOrder(base(), opts);
  await local.transitionOrder(a.id, 'pending', { status: 'ready' });

  await local.cancelOrder(a.id); // как клиент: allowReady выключен

  let orders = [];
  local.subscribeOrders(['r01'], (x) => (orders = x))();
  assert.equal(orders.find((x) => x.id === a.id).status, 'ready');
});

test('выданный заказ отменить нельзя', async () => {
  await local.resetAll();
  const a = await local.placeOrder(base(), opts);
  await local.transitionOrder(a.id, 'pending', { status: 'ready' });
  await local.transitionOrder(a.id, 'ready', { status: 'done', issuedAt: Date.now() });
  await local.cancelOrder(a.id, { allowReady: true });

  let orders = [];
  local.subscribeOrders(['r01'], (x) => (orders = x))();
  assert.equal(orders.find((x) => x.id === a.id).status, 'done');
});

test('переход статуса не срабатывает из неожиданного состояния', async () => {
  await local.resetAll();
  const a = await local.placeOrder(base(), opts);
  await local.cancelOrder(a.id);

  assert.equal(await local.transitionOrder(a.id, 'pending', { status: 'ready' }), false);
  let orders = [];
  local.subscribeOrders(['r01'], (x) => (orders = x))();
  assert.equal(orders.find((x) => x.id === a.id).status, 'cancelled');
});

test('незавершённый вчерашний заказ остаётся в списке кухни, а завершённый — нет', async () => {
  await local.resetAll();
  const active = await local.placeOrder(base(), opts);
  const doneOld = await local.placeOrder(base(), opts);
  await local.transitionOrder(doneOld.id, 'pending', { status: 'ready' });
  await local.transitionOrder(doneOld.id, 'ready', { status: 'done', issuedAt: Date.now() });

  // переносим заказы во вчерашний день напрямую в «базе»
  const db = JSON.parse(localStorage.getItem('ep_db_v1'));
  const yesterday = Date.now() - 24 * 60 * 60 * 1000;
  db.orders[active.id].createdAt = yesterday;
  db.orders[doneOld.id].createdAt = yesterday;
  localStorage.setItem('ep_db_v1', JSON.stringify(db));

  let orders = [];
  local.subscribeOrders(['r01'], (x) => (orders = x))();
  assert.deepEqual(
    orders.map((o) => o.id),
    [active.id]
  );
});
