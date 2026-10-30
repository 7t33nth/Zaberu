import { distanceParts, walkingMinutes } from '../lib/geo.js';
import { useT } from '../lib/i18n/store.js';

// Единый формат расстояния во всех местах: карточка, попап на карте.
export default function DistanceBadge({ meters, className = '' }) {
  const t = useT();
  const parts = distanceParts(meters);
  const minutes = walkingMinutes(meters);
  if (!parts || minutes == null) return null;

  const distance = t(parts.unit === 'm' ? 'geo.meters' : 'geo.km', { value: parts.value });
  return <span className={className}>{t('geo.walk', { distance, minutes })}</span>;
}
