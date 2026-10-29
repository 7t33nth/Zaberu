// Точки одной сети. В датасете каждая точка — отдельное заведение с тем же названием,
// поэтому «все адреса Burger King» — это все записи с таким же названием. Функция
// вынесена из data/index.js, чтобы её можно было проверить без импорта JSON-датасета.
const brandKey = (r) => r.name.trim().toLowerCase();

export function locationsOf(restaurantId, list) {
  const current = list.find((r) => r.id === restaurantId);
  if (!current) return [];
  const key = brandKey(current);
  return list.filter((r) => brandKey(r) === key);
}
