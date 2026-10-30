import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NEAR_RADIUS_M,
  distanceParts,
  haversineMeters,
  isNear,
  walkingMinutes
} from '../src/lib/geo.js';

const burgerKing = { lat: 43.264057, lon: 76.929463 };
const navat = { lat: 43.263265, lon: 76.942034 };

test('haversineMeters: расстояние между двумя точками Алматы', () => {
  const meters = haversineMeters(burgerKing, navat);
  assert.ok(meters > 1000 && meters < 1050, `ожидали ~1022 м, получили ${meters}`);
});

test('haversineMeters: одна и та же точка даёт 0', () => {
  assert.equal(haversineMeters(burgerKing, burgerKing), 0);
});

test('walkingMinutes: переводит метры в минуты спокойным шагом', () => {
  assert.equal(walkingMinutes(450), 6);
  assert.equal(walkingMinutes(0), 1);
  assert.equal(walkingMinutes(1500), 20);
});

test('distanceParts: метры до километра и километры после', () => {
  assert.deepEqual(distanceParts(447), { value: 450, unit: 'm' });
  assert.deepEqual(distanceParts(1022), { value: 1, unit: 'km' });
  assert.deepEqual(distanceParts(1540), { value: 1.5, unit: 'km' });
  assert.equal(distanceParts(Number.NaN), null);
});

test('isNear: граница радиуса 1,5 км', () => {
  assert.equal(isNear(NEAR_RADIUS_M), true);
  assert.equal(isNear(NEAR_RADIUS_M + 1), false);
  assert.equal(isNear(null), false);
});
