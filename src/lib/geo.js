// Геометрия для карты и фильтра «рядом со мной». Без React и Leaflet, чтобы
// расстояния можно было проверить обычными тестами.
export const NEAR_RADIUS_M = 1500;
export const WALK_SPEED_MPS = 1.25; // ~4,5 км/ч — спокойный шаг с учётом светофоров

const EARTH_RADIUS_M = 6371000;
const toRad = (deg) => (deg * Math.PI) / 180;

// Формула гаверсинусов: расстояние по большому кругу между двумя точками.
export function haversineMeters(a, b) {
  if (!a || !b) return null;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// Сколько минут идти пешком. Минимум 1 минута, чтобы «0 мин» не выглядело ошибкой.
export function walkingMinutes(meters) {
  if (!Number.isFinite(meters) || meters < 0) return null;
  return Math.max(1, Math.round(meters / (WALK_SPEED_MPS * 60)));
}

// Значение и единица отдельно — единицы переводятся через i18n.
export function distanceParts(meters) {
  if (!Number.isFinite(meters) || meters < 0) return null;
  if (meters < 1000) return { value: Math.max(10, Math.round(meters / 10) * 10), unit: 'm' };
  return { value: Number((meters / 1000).toFixed(1)), unit: 'km' };
}

export function isNear(meters, radius = NEAR_RADIUS_M) {
  return Number.isFinite(meters) && meters <= radius;
}

// Маршрут строим не сами, а отдаём Google Картам: приложению не нужно быть навигатором.
export function googleMapsUrl(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}
