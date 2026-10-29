import test from 'node:test';
import assert from 'node:assert/strict';
import { locationsOf } from '../src/lib/locations.js';

const list = [
  { id: 'r01', name: 'Burger King', address: 'Макатаева, 127/1' },
  { id: 'r02', name: 'Burger King', address: 'Абая, 10' },
  { id: 'r03', name: 'Wendy’s', address: 'Достык, 5' }
];

test('locationsOf возвращает все точки сети, включая текущую', () => {
  assert.deepEqual(
    locationsOf('r01', list).map((r) => r.id),
    ['r01', 'r02']
  );
  assert.deepEqual(
    locationsOf('r02', list).map((r) => r.id),
    ['r01', 'r02']
  );
});

test('locationsOf не смешивает разные сети', () => {
  assert.deepEqual(
    locationsOf('r03', list).map((r) => r.id),
    ['r03']
  );
});

test('locationsOf сравнивает названия без учёта регистра и лишних пробелов', () => {
  const noisy = [{ id: 'a', name: 'Burger King ' }, { id: 'b', name: ' burger king' }];
  assert.deepEqual(
    locationsOf('a', noisy).map((r) => r.id),
    ['a', 'b']
  );
});

test('locationsOf возвращает пустой список для неизвестного заведения', () => {
  assert.deepEqual(locationsOf('nope', list), []);
});
