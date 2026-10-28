import test from 'node:test';
import assert from 'node:assert/strict';
import { subscribeWithDayRollover } from '../src/lib/dayRollover.js';

const at = (y, m, d, h, min, s = 0) => new Date(y, m - 1, d, h, min, s, 0).getTime();

function tracked() {
  const state = { created: 0, stopped: 0 };
  const create = () => {
    state.created += 1;
    return () => {
      state.stopped += 1;
    };
  };
  return { state, create };
}

test('подписка пересоздаётся при наступлении новой даты', (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: at(2026, 5, 1, 23, 59, 50) });
  const { state, create } = tracked();
  const stop = subscribeWithDayRollover(create, { checkMs: 1000 });

  assert.equal(state.created, 1);

  t.mock.timers.tick(5000); // 23:59:55 — всё ещё сегодня
  assert.equal(state.created, 1);
  assert.equal(state.stopped, 0);

  t.mock.timers.tick(10000); // 00:00:05 — уже завтра
  assert.equal(state.created, 2);
  assert.equal(state.stopped, 1);

  stop();
});

test('в течение дня подписка не дёргается', (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: at(2026, 5, 1, 9, 0, 0) });
  const { state, create } = tracked();
  const stop = subscribeWithDayRollover(create, { checkMs: 1000 });

  t.mock.timers.tick(12 * 60 * 60 * 1000); // полдень
  assert.equal(state.created, 1);
  assert.equal(state.stopped, 0);

  stop();
});

test('после отписки таймер больше не пересоздаёт подписку', (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: at(2026, 5, 1, 23, 59, 50) });
  const { state, create } = tracked();
  const stop = subscribeWithDayRollover(create, { checkMs: 1000 });

  stop();
  assert.equal(state.stopped, 1);

  t.mock.timers.tick(60000);
  assert.equal(state.created, 1);
  assert.equal(state.stopped, 1);
});
