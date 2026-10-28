import { Link } from 'react-router-dom';
import { CUISINE_LABELS } from '../data/index.js';
import { hoursForDay, isOpenNow, ordersOpen, formatClock } from '../lib/time.js';
import { LocationIcon, StarIcon } from './Icons.jsx';
import { useT } from '../lib/i18n/store.js';

function status(restaurant, now, t) {
  const { openMs, closeMs } = hoursForDay(restaurant.hours, now);
  if (!ordersOpen(restaurant.hours, now))
    return { text: t('restaurantStatus.closedToday'), tone: 'closed' };
  if (isOpenNow(restaurant.hours, now))
    return { text: t('restaurantStatus.openUntil', { time: formatClock(closeMs) }), tone: 'open' };
  return { text: t('restaurantStatus.opensAt', { time: formatClock(openMs) }), tone: 'soon' };
}

// Обложка лежит рядом с остальными картинками заведения:
// public/images/{id}/flash.webp -> URL /images/{id}/flash.webp.
// Если файла нет — прячем <img>, остаются тёмная подложка и градиент.
const coverFor = (restaurant) => `/images/${restaurant.id}/flash.webp`;

export default function RestaurantCard({ restaurant, now }) {
  const t = useT();
  const st = status(restaurant, now, t);
  return (
    <Link
      to={`/restaurant/${restaurant.id}`}
      className="block overflow-hidden rounded-3xl bg-card border border-line active:scale-[0.99] transition-all hover:shadow-lg"
    >
      {/* Верхняя половина: изображение с градиентом затемнения сверху вниз */}
      <div className="relative h-28 bg-paper">
        <img
          src={coverFor(restaurant)}
          alt=""
          aria-hidden="true"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 to-black/70" />
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-neutral-900">
          <StarIcon className="w-3.5 h-3.5 text-warn" />
          <span>{restaurant.rating}</span>
        </span>
      </div>

      {/* Нижняя часть: фон и текст подстраиваются под тему (bg-card/text-ink/...) */}
      <div className="bg-card p-4">
        <h3 className="font-extrabold text-ink text-lg leading-tight">{restaurant.name}</h3>
        <div className="flex items-center gap-1 text-muted text-sm mt-0.5">
          <LocationIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{restaurant.address}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {restaurant.cuisines.map((c) => (
            <span
              key={c}
              className="text-xs bg-paper text-muted px-3 py-1 rounded-full font-medium"
            >
              {CUISINE_LABELS[c] || c}
            </span>
          ))}
        </div>
        <div
          className={`mt-3 text-xs font-semibold rounded-full px-3 py-1.5 ${
            st.tone === 'open'
              ? 'bg-accent-soft text-accent-dark'
              : st.tone === 'soon'
                ? 'bg-warn-soft text-warn'
                : 'bg-paper text-muted'
          }`}
        >
          {st.text}
        </div>
      </div>
    </Link>
  );
}
