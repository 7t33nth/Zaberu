// Доступ сотрудника к заведениям. Документ staff/{email} заводится вручную в консоли
// Firebase, поэтому там легко получить опечатку или устаревший id: список может не
// совпасть ни с одним заведением каталога. Тогда показывать нечего — нужен понятный
// экран «нет доступа», а не падение на allowedRestaurants[0].id.
export const ALL_RESTAURANTS = '*';

/** Заведения, доступные сотруднику, в порядке каталога. */
export function allowedRestaurantsFor(staffRestaurantIds = [], restaurants = []) {
  if (staffRestaurantIds.includes(ALL_RESTAURANTS)) return restaurants;
  return restaurants.filter((r) => staffRestaurantIds.includes(r.id));
}

/** Есть ли у сотрудника доступ к конкретному заведению. */
export function isRestaurantAllowed(staffRestaurantIds = [], restaurantId) {
  return staffRestaurantIds.includes(ALL_RESTAURANTS) || staffRestaurantIds.includes(restaurantId);
}
