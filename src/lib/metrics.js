import { SLOT_MS, ceilToSlot } from './time.js';

export const BASELINE_WAIT_MIN = 20; // из условия задачи: ожидание без предзаказа
export const TARGET_WAIT_MIN = 2;

// Ожидание у стойки: от момента, когда клиент отметил «Я на месте»
// (если не отметил — от назначенного времени выдачи), до момента выдачи.
export function waitMs(order) {
  if (order.status !== 'done' || !order.issuedAt) return null;
  const from = order.arrivedAt ?? order.pickupAt;
  return Math.max(0, order.issuedAt - from);
}

export function computeMetrics(orders, { capacity, now = Date.now() } = {}) {
  const active = orders.filter((o) => o.status === 'pending' || o.status === 'ready');
  const done = orders.filter((o) => o.status === 'done');

  const waits = done.map(waitMs).filter((w) => w !== null);
  const avgWaitMs = waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : null;
  const onTarget = waits.filter((w) => w <= TARGET_WAIT_MIN * 60000).length;

  const hourAgo = now - 60 * 60000;
  const issuedLastHour = done.filter((o) => o.issuedAt >= hourAgo).length;

  // загрузка кухни по слотам на ближайшие 12 слотов (1 час)
  const startSlot = ceilToSlot(now) - SLOT_MS;
  const slots = [];
  for (let i = 0; i < 12; i++) {
    const start = startSlot + i * SLOT_MS;
    const used = orders
      .filter((o) => o.pickupAt === start && o.status !== 'cancelled')
      .reduce((s, o) => s + o.units, 0);
    slots.push({ start, used, load: capacity ? Math.min(1, used / capacity) : 0 });
  }
  const peakLoad = slots.reduce((m, s) => Math.max(m, s.load), 0);

  return {
    activeCount: active.length,
    doneCount: done.length,
    avgWaitMs,
    onTargetShare: waits.length ? onTarget / waits.length : null,
    issuedLastHour,
    peakLoad,
    slots
  };
}
