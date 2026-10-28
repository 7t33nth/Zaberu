import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allowedRestaurantsFor,
  isRestaurantAllowed
} from '../src/lib/staffAccess.js';

const catalog = [{ id: 'r01' }, { id: 'r02' }, { id: 'r03' }];

test('wildcard открывает все заведения каталога', () => {
  assert.deepEqual(allowedRestaurantsFor(['*'], catalog), catalog);
});

test('список доступов фильтрует каталог и сохраняет его порядок', () => {
  assert.deepEqual(
    allowedRestaurantsFor(['r03', 'r01'], catalog).map((r) => r.id),
    ['r01', 'r03']
  );
});

test('опечатка в id не даёт ни одного заведения (раньше здесь падала админка)', () => {
  assert.deepEqual(allowedRestaurantsFor(['r99'], catalog), []);
  assert.deepEqual(allowedRestaurantsFor(['R01'], catalog), []);
});

test('пустой документ staff не даёт доступа', () => {
  assert.deepEqual(allowedRestaurantsFor([], catalog), []);
  assert.deepEqual(allowedRestaurantsFor(undefined, catalog), []);
});

test('isRestaurantAllowed учитывает wildcard и точное совпадение', () => {
  assert.equal(isRestaurantAllowed(['*'], 'r07'), true);
  assert.equal(isRestaurantAllowed(['r01'], 'r01'), true);
  assert.equal(isRestaurantAllowed(['r01'], 'r02'), false);
  assert.equal(isRestaurantAllowed([], 'r01'), false);
});
