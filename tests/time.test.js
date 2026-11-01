import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANCEL_WINDOW_MS,
  DAY_MS,
  SLOT_MS,
  buildSlots,
  ceilToSlot,
  estimatePrepMinutes,
  formatCountdown,
  hoursForDay,
  isOpenNow,
  ordersOpen,
  parseHours,
  pluralPortions,
  serviceStatus,
  serviceWindow,
  startOfDay
} from '../src/lib/time.js';

const at = (h, m = 0) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
};

test('parseHours понимает полночь как конец дня', () => {
  assert.deepEqual(parseHours('10:00-23:00'), { open: 600, close: 1380 });
  assert.deepEqual(parseHours('11:00-00:00'), { open: 660, close: 1440 });
});

test('estimatePrepMinutes: самое долгое блюдо + надбавка от вместимости кухни', () => {
  const dish = (prepMinutes) => ({ prepMinutes });
  assert.equal(estimatePrepMinutes([]), 0);
  assert.equal(estimatePrepMinutes([{ dish: dish(15), qty: 1 }], 10), 15);
  // 4 порции: первые 2 — без надбавки, ещё 2 при вместимости 10 умещаются в одну лишнюю партию (+5 мин)
  assert.equal(
    estimatePrepMinutes(
      [
        { dish: dish(15), qty: 2 },
        { dish: dish(5), qty: 2 }
      ],
      10
    ),
    20
  );
  // без вместимости (заведение ещё не выбрано) считаем только по самому долгому блюду
  assert.equal(
    estimatePrepMinutes(
      [
        { dish: dish(15), qty: 2 },
        { dish: dish(5), qty: 2 }
      ],
      undefined
    ),
    15
  );
});

test('большой заказ одного блюда у маленькой кухни оценивается дольше, чем у большой', () => {
  const dish = (prepMinutes) => ({ prepMinutes });
  const tenBurgers = [{ dish: dish(10), qty: 10 }];
  // вместимость 10 порций/слот: 8 порций сверх бесплатных = 1 лишняя партия (+5 мин)
  assert.equal(estimatePrepMinutes(tenBurgers, 10), 15);
  // вместимость 4 порции/слот: 8 порций сверх бесплатных = 2 лишние партии (+10 мин)
  assert.equal(estimatePrepMinutes(tenBurgers, 4), 20);
});

test('первый слот не раньше готовности заказа и лежит на границе 5 минут', () => {
  const now = at(12, 7);
  const slots = buildSlots({ hours: '10:00-23:00', prepMinutes: 15, capacity: 10, units: 1, now });
  assert.equal(slots[0].start, ceilToSlot(now + 15 * 60000));
  assert.equal(slots[0].start % SLOT_MS, 0);
  assert.ok(slots.every((s, i) => i === 0 || s.start - slots[i - 1].start === SLOT_MS));
});

test('заполненный слот недоступен, если заказ в него не помещается', () => {
  const now = at(12, 0);
  const base = buildSlots({ hours: '10:00-23:00', prepMinutes: 10, capacity: 6, units: 1, now });
  const loads = { [base[0].start]: 6, [base[1].start]: 5 };
  const slots = buildSlots({
    hours: '10:00-23:00',
    prepMinutes: 10,
    capacity: 6,
    units: 2,
    loads,
    now
  });
  assert.equal(slots[0].available, false);
  assert.equal(slots[1].available, false); // свободна 1 порция, заказ на 2
  assert.equal(slots[2].available, true);
  const one = buildSlots({
    hours: '10:00-23:00',
    prepMinutes: 10,
    capacity: 6,
    units: 1,
    loads,
    now
  });
  assert.equal(one[1].available, true);
});

test('слоты не выходят за время закрытия', () => {
  const now = at(22, 30);
  const slots = buildSlots({ hours: '10:00-23:00', prepMinutes: 10, capacity: 6, units: 1, now });
  const { closeMs } = hoursForDay('10:00-23:00', now);
  assert.ok(slots.length > 0);
  assert.ok(slots.every((s) => s.start <= closeMs - SLOT_MS));
});

test('до открытия слоты начинаются от времени открытия + готовка', () => {
  const now = at(8, 0);
  const slots = buildSlots({ hours: '10:00-23:00', prepMinutes: 15, capacity: 6, units: 1, now });
  assert.equal(slots[0].start, at(10, 15));
});

test('после закрытия заказы не принимаются', () => {
  assert.equal(ordersOpen('10:00-23:00', at(12, 0)), true);
  assert.equal(ordersOpen('10:00-23:00', at(22, 55)), false);
});

test('окно самостоятельной отмены — 3 минуты', () => {
  assert.equal(CANCEL_WINDOW_MS, 3 * 60 * 1000);
});

test('смена через полночь: в 01:00 заведение ещё открыто', () => {
  const now = at(1);
  const state = serviceStatus('12:00-02:00', now);
  assert.equal(state.open, true);
  assert.equal(state.closeMs, startOfDay(now) + 2 * 60 * 60000);
  assert.equal(isOpenNow('12:00-02:00', now), true);
});

test('после ночного закрытия предзаказ идёт на открытие этого же дня', () => {
  const now = at(3);
  const state = serviceStatus('12:00-02:00', now);
  assert.equal(state.open, false);
  assert.equal(state.openMs, at(12, 0));

  const slots = buildSlots({ hours: '12:00-02:00', prepMinutes: 15, capacity: 6, units: 1, now });
  assert.equal(slots[0].start, at(12, 15));
});

test('после закрытия слоты строятся на следующий рабочий день', () => {
  const now = at(23, 30);
  const window = serviceWindow('10:00-23:00', now, 15);
  assert.equal(window.open, false);
  assert.equal(window.isNextDay, true);

  const slots = buildSlots({ hours: '10:00-23:00', prepMinutes: 15, capacity: 6, units: 1, now });
  const tomorrow = startOfDay(now) + DAY_MS;
  assert.equal(slots[0].start, tomorrow + 10 * 60 * 60000 + 15 * 60000);
  assert.ok(slots.length > 0);
  assert.ok(slots.every((s) => startOfDay(s.start) === tomorrow));
  assert.ok(slots.every((s) => s.start <= tomorrow + 23 * 60 * 60000 - SLOT_MS));
});

test('форматирование', () => {
  assert.equal(formatCountdown(125000), '2:05');
  assert.equal(formatCountdown(-5000), '−0:05');
  assert.equal(pluralPortions(1), '1 порция');
  assert.equal(pluralPortions(3), '3 порции');
  assert.equal(pluralPortions(5), '5 порций');
  assert.equal(pluralPortions(11), '11 порций');
});
