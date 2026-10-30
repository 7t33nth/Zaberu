import { useEffect } from 'react';
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Link } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import DistanceBadge from './DistanceBadge.jsx';
import { LocationIcon, StarIcon, HeartIcon } from './Icons.jsx';
import { googleMapsUrl } from '../lib/geo.js';
import { useT } from '../lib/i18n/store.js';
import { useFavorites } from '../store/useFavorites.js';

// Центр Алматы — стартовый вид, пока геолокация не получена.
const MAP_CENTER = [43.265, 76.94];

const restaurantIcon = L.divIcon({
  className: 'zaberu-marker',
  html: '<span class="zaberu-marker-pin"><span class="zaberu-marker-dot"></span></span>',
  iconSize: [36, 46],
  iconAnchor: [18, 44],
  popupAnchor: [0, -40]
});

const userIcon = L.divIcon({
  className: 'zaberu-user-icon',
  html: '<span class="zaberu-user-pulse"></span><span class="zaberu-user-dot"></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13]
});

// Когда координаты появились/обновились — показываем пользователя крупнее.
function UserFocus({ user }) {
  const map = useMap();
  useEffect(() => {
    if (!user) return;
    map.flyTo([user.lat, user.lon], Math.max(map.getZoom(), 14), { duration: 0.8 });
  }, [map, user]);
  return null;
}

export default function MapView({ restaurants, user, onLocate, locating }) {
  const t = useT();
  const favoriteRestaurantIds = useFavorites((s) => s.restaurantIds);
  const toggleRestaurant = useFavorites((s) => s.toggleRestaurant);

  return (
    <div
      role="region"
      aria-label={t('map.aria')}
      className="relative isolate overflow-hidden rounded-3xl border border-line bg-card"
    >
      <MapContainer
        center={user ? [user.lat, user.lon] : MAP_CENTER}
        zoom={user ? 14 : 12}
        scrollWheelZoom={false}
        className="zaberu-map h-[540px] w-full lg:h-[680px]"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {user && (
          <Marker position={[user.lat, user.lon]} icon={userIcon} zIndexOffset={1000}>
            <Tooltip permanent direction="top" offset={[0, -14]} className="zaberu-tooltip">
              {t('map.youAreHere')}
            </Tooltip>
          </Marker>
        )}

        {restaurants.map((r) =>
          Number.isFinite(r.lat) && Number.isFinite(r.lon) ? (
            <Marker
              key={r.id}
              position={[r.lat, r.lon]}
              icon={restaurantIcon}
              title={r.name}
              alt={r.name}
            >
              <Popup maxWidth={300} className="zaberu-popup" autoPanPadding={[24, 72]}>
                <div className="min-w-[220px]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-base font-extrabold leading-tight text-ink">{r.name}</div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRestaurant(r.id);
                      }}
                      aria-label={
                        favoriteRestaurantIds.includes(r.id)
                          ? t('favorites.removeRestaurant')
                          : t('favorites.addRestaurant')
                      }
                      className="shrink-0 p-1 -mr-1 -mt-1 text-muted hover:text-danger transition-colors"
                    >
                      <HeartIcon
                        filled={favoriteRestaurantIds.includes(r.id)}
                        className={`h-4 w-4 ${
                          favoriteRestaurantIds.includes(r.id)
                            ? 'text-danger fill-danger'
                            : 'text-muted'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs font-bold text-ink">
                    <StarIcon className="h-3.5 w-3.5 text-warn" />
                    <span>{r.rating}</span>
                    <span className="font-normal text-muted">
                      · {r.cuisines.slice(0, 2).join(' · ')}
                    </span>
                  </div>
                  <DistanceBadge
                    meters={r.distanceM}
                    className="mt-2 block text-xs font-bold text-accent-dark"
                  />
                  <div className="mt-3 flex gap-2">
                    <Link
                      to={`/restaurant/${r.id}`}
                      className="zaberu-popup-cta inline-flex min-h-[36px] flex-1 items-center justify-center rounded-lg bg-brand px-2 text-center text-xs font-bold leading-tight text-white transition-opacity hover:opacity-90"
                    >
                      {t('map.openMenu')}
                    </Link>
                    <a
                      href={googleMapsUrl(r.lat, r.lon)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="zaberu-popup-secondary inline-flex min-h-[36px] flex-1 items-center justify-center rounded-lg border border-line bg-card px-2 text-center text-xs font-bold leading-tight text-ink transition-colors hover:border-ink/40"
                    >
                      {t('map.openGoogle')}
                    </a>
                  </div>
                </div>
              </Popup>
            </Marker>
          ) : null
        )}

        <UserFocus user={user} />
      </MapContainer>

      <div className="pointer-events-none absolute inset-x-0 top-3 z-[650] flex justify-center px-3">
        <button
          type="button"
          onClick={onLocate}
          disabled={locating}
          className="pointer-events-auto inline-flex min-h-[40px] items-center gap-2 rounded-full border border-line bg-card/95 px-4 text-xs font-bold text-ink shadow-lg backdrop-blur transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <LocationIcon className="h-4 w-4 text-brand" />
          {locating ? t('map.locating') : user ? t('map.recenter') : t('map.findMe')}
        </button>
      </div>

      {restaurants.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[1000] flex justify-center px-4">
          <div className="rounded-full border border-line bg-card/95 px-4 py-2 text-xs font-semibold text-muted shadow-lg backdrop-blur">
            {t('home.mapEmpty')}
          </div>
        </div>
      )}
    </div>
  );
}
