import test from 'node:test';
import assert from 'node:assert/strict';

// минимальная замена localStorage и window для Node
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k)
};
globalThis.window = { dispatchEvent: () => {} };

const {
  acknowledgeOrder,
  addMyOrderId,
  clearAllOrderAttention,
  getAttentionOrderIds,
  getMyOrderIds,
  hasOrderAttention,
  isOrderAcknowledged,
  markOrderAttention,
  removeMyOrderId
} = await import('../src/lib/myOrders.js');

const reset = () => storage.clear();

test('myOrders: отменённый заказ остаётся в истории после «Понял(а)»', () => {
  reset();
  addMyOrderId('o_1');
  addMyOrderId('o_2');
  assert.deepEqual(getMyOrderIds(), ['o_2', 'o_1']);

  acknowledgeOrder('o_2');
  assert.equal(isOrderAcknowledged('o_2'), true);
  // подтверждение не удаляет заказ из истории
  assert.deepEqual(getMyOrderIds(), ['o_2', 'o_1']);

  removeMyOrderId('o_2');
  assert.deepEqual(getMyOrderIds(), ['o_1']);
});

test('myOrders: индикатор обновлений живёт до просмотра', () => {
  reset();
  addMyOrderId('o_1');
  assert.equal(hasOrderAttention(), false);

  markOrderAttention('o_1');
  assert.equal(hasOrderAttention(), true);
  assert.deepEqual(getAttentionOrderIds(), ['o_1']);

  clearAllOrderAttention();
  assert.equal(hasOrderAttention(), false);
});

test('myOrders: «Получил(а)» снимает индикатор, но не удаляет заказ', () => {
  reset();
  addMyOrderId('o_1');
  markOrderAttention('o_1');

  acknowledgeOrder('o_1');
  assert.equal(hasOrderAttention(), false);
  assert.deepEqual(getMyOrderIds(), ['o_1']);
});
