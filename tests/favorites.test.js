import test from 'node:test';
import assert from 'node:assert/strict';

// минимальная замена localStorage для Node
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k)
};

const { useFavorites } = await import('../src/store/useFavorites.js');

test('useFavorites: добавление и удаление заведения из избранного', () => {
  const store = useFavorites.getState();
  store.clear();

  assert.equal(store.isRestaurantFavorite('r01'), false);
  store.toggleRestaurant('r01');
  assert.equal(useFavorites.getState().isRestaurantFavorite('r01'), true);

  store.toggleRestaurant('r01');
  assert.equal(useFavorites.getState().isRestaurantFavorite('r01'), false);
});

test('useFavorites: добавление и удаление блюда из избранного', () => {
  const store = useFavorites.getState();
  store.clear();

  assert.equal(store.isDishFavorite('d01'), false);
  store.toggleDish('d01');
  assert.equal(useFavorites.getState().isDishFavorite('d01'), true);

  store.toggleDish('d01');
  assert.equal(useFavorites.getState().isDishFavorite('d01'), false);
});

test('useFavorites: множественное добавление, localStorage и очистка', () => {
  const store = useFavorites.getState();
  store.clear();

  store.toggleRestaurant('r01');
  store.toggleRestaurant('r02');
  store.toggleDish('d01');
  store.toggleDish('d02');

  const current = useFavorites.getState();
  assert.deepEqual(current.restaurantIds, ['r01', 'r02']);
  assert.deepEqual(current.dishIds, ['d01', 'd02']);

  // Проверка сериализации в localStorage
  const saved = JSON.parse(globalThis.localStorage.getItem('express-pickup-favorites'));
  assert.deepEqual(saved.state.restaurantIds, ['r01', 'r02']);
  assert.deepEqual(saved.state.dishIds, ['d01', 'd02']);

  store.clear();
  const cleared = useFavorites.getState();
  assert.deepEqual(cleared.restaurantIds, []);
  assert.deepEqual(cleared.dishIds, []);
});
