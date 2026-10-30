import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { restaurants, CUISINE_GROUPS } from '../data/index.js';
import RestaurantCard from '../components/RestaurantCard.jsx';
import ActiveOrderBanner from '../components/ActiveOrderBanner.jsx';
import CitySelect from '../components/CitySelect.jsx';
import Steps from '../components/Steps.jsx';
import Footer from '../components/Footer.jsx';
import InstallBanner from '../components/InstallBanner.jsx';
import { ListIcon, LocationIcon, MapIcon, SearchIcon } from '../components/Icons.jsx';
import { NEAR_RADIUS_M, haversineMeters } from '../lib/geo.js';
import { useT } from '../lib/i18n/store.js';

// Leaflet тянет заметный кусок JS/CSS, поэтому грузим карту только когда её открыли.
const MapView = lazy(() => import('../components/MapView.jsx'));

export default function Home() {
  const t = useT();

  const HOW_IT_WORKS = [
    ['1', t('steps.dishes'), t('home.howItWorksStep1')],
    ['2', t('steps.time'), t('home.howItWorksStep2')],
    ['3', t('steps.confirm'), t('home.howItWorksStep3')]
  ];

  const RATING_OPTIONS = [
    [0, t('home.ratingAny')],
    [4.5, '4.5+'],
    [4.8, '4.8+']
  ];

  const [search, setSearch] = useState('');
  const [cuisines, setCuisines] = useState(() => new Set());
  const [minRating, setMinRating] = useState(0);
  const [view, setView] = useState('list');
  const [coords, setCoords] = useState(null);
  const [geoState, setGeoState] = useState('idle');
  const [nearMe, setNearMe] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Геолокация нужна и карте, и фильтру «рядом со мной». Запрашиваем только по
  // действию пользователя (открыл карту / включил фильтр), а не при загрузке главной.
  const requestLocation = useCallback(() => {
    if (geoState === 'locating') return;
    if (!navigator.geolocation) {
      setGeoState('unsupported');
      setNearMe(false);
      return;
    }
    setGeoState('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGeoState('ready');
      },
      (err) => {
        setGeoState(err.code === 1 ? 'denied' : 'error');
        setNearMe(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, [geoState]);

  function showMap() {
    setView('map');
    if (!coords && geoState !== 'denied') requestLocation();
  }

  function toggleNearMe() {
    if (nearMe) {
      setNearMe(false);
      return;
    }
    setNearMe(true);
    if (!coords) requestLocation();
  }

  function toggleCuisine(groupId) {
    setCuisines((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  // Группы кухонь -> набор исходных тегов датасета, которые под них попадают.
  const activeTags = new Set(
    CUISINE_GROUPS.filter((g) => cuisines.has(g.id)).flatMap((g) => g.tags)
  );

  const located = useMemo(
    () =>
      restaurants.map((r) => ({
        ...r,
        distanceM:
          coords && Number.isFinite(r.lat) && Number.isFinite(r.lon)
            ? haversineMeters(coords, { lat: r.lat, lon: r.lon })
            : null
      })),
    [coords]
  );

  const nearActive = nearMe && Boolean(coords);
  const filtered = located
    .filter(
      (r) =>
        r.name.toLowerCase().includes(search.trim().toLowerCase()) &&
        r.rating >= minRating &&
        (activeTags.size === 0 || r.cuisines.some((c) => activeTags.has(c))) &&
        (!nearActive || (r.distanceM != null && r.distanceM <= NEAR_RADIUS_M))
    )
    .sort((a, b) => (nearActive ? a.distanceM - b.distanceM : 0));

  const searchBox = (id) => (
    <div className="relative">
      <label className="sr-only" htmlFor={id}>
        {t('home.searchAria')}
      </label>
      <span
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
        aria-hidden="true"
      >
        <SearchIcon className="w-4 h-4 text-muted" />
      </span>
      <input
        id={id}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('home.searchPlaceholder')}
        className="w-full bg-card border border-line rounded-full pl-10 pr-4 py-3 text-base lg:text-sm outline-none focus:ring-2 focus:ring-accent-dark shadow-sm placeholder:text-muted"
      />
    </div>
  );

  const ratingRow = (
    <div className="flex gap-2">
      {RATING_OPTIONS.map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => setMinRating(value)}
          aria-pressed={minRating === value}
          className={`inline-flex min-h-[40px] items-center px-4 rounded-full text-xs font-semibold border ${
            minRating === value
              ? 'bg-primary text-white border-primary'
              : 'bg-card text-muted border-line'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="pb-10 lg:pb-20">
      {/* Мобильная и планшетная вёрстка (<1024px) не менялась: узкая колонка сверху вниз. */}
      <header className="px-4 pt-8 pb-5 lg:px-10 lg:pt-14 lg:pb-10 lg:max-w-[1340px] lg:mx-auto">
        <div className="lg:grid lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:items-center">
          <div>
            <div className="flex items-start justify-between gap-3 lg:block">
              <h1 className="text-[28px] lg:text-[56px] leading-[1.1] lg:leading-[1.05] font-extrabold text-ink lg:max-w-[16ch]">
                {t('home.title')}
              </h1>
              <div className="lg:hidden">
                <CitySelect />
              </div>
            </div>
            <p className="text-muted text-sm lg:text-lg mt-2 lg:mt-5 max-w-[32ch] lg:max-w-[46ch]">
              {t('home.subtitle')}
            </p>
            <div className="mt-4 lg:hidden">
              <Steps current={1} />
            </div>

            <div className="hidden lg:flex items-center gap-4 mt-9">
              <CitySelect />
              <span className="text-sm text-muted">
                {t('home.restaurantsCount', { count: restaurants.length })}
              </span>
            </div>
            <div className="hidden lg:block mt-6 max-w-[420px]">{searchBox('search-desktop')}</div>
          </div>

          <div className="hidden lg:block bg-card border border-line rounded-3xl p-6">
            <div className="text-xs font-bold text-muted uppercase tracking-wide">
              {t('home.howItWorks')}
            </div>
            <ol className="mt-4 flex flex-col gap-4">
              {HOW_IT_WORKS.map(([n, title, text]) => (
                <li key={n} className="flex gap-3">
                  <span className="w-8 h-8 shrink-0 rounded-full bg-brand text-white font-bold flex items-center justify-center">
                    {n}
                  </span>
                  <div>
                    <div className="font-bold text-ink leading-tight">{title}</div>
                    <div className="text-sm text-muted mt-0.5">{text}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </header>

      <div className="lg:max-w-[1340px] lg:mx-auto lg:px-10">
        <ActiveOrderBanner />

        <div className="lg:grid lg:grid-cols-[250px_1fr] lg:gap-10 lg:items-start lg:mt-8">
          <aside className="hidden lg:flex lg:flex-col lg:gap-4 lg:sticky lg:top-6">
            <div className="bg-card border border-line rounded-3xl p-4">
              <div className="text-xs font-bold text-muted uppercase tracking-wide mb-3">
                {t('home.ratingLabel')}
              </div>
              <div className="flex flex-col gap-0.5">
                {RATING_OPTIONS.map(([value, label]) => (
                  <label
                    key={value}
                    className="flex items-center gap-2.5 text-sm py-1.5 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="rating"
                      checked={minRating === value}
                      onChange={() => setMinRating(value)}
                      className="w-4 h-4 accent-[rgb(var(--color-brand))] shrink-0"
                    />
                    <span className={minRating === value ? 'text-ink font-semibold' : 'text-muted'}>
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-card border border-line rounded-3xl p-4">
              <div className="text-xs font-bold text-muted uppercase tracking-wide mb-3">
                {t('home.cuisineLabel')}
              </div>
              <div className="flex flex-col gap-0.5">
                {CUISINE_GROUPS.map((g) => (
                  <label
                    key={g.id}
                    className="flex items-center gap-2.5 text-sm py-1.5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={cuisines.has(g.id)}
                      onChange={() => toggleCuisine(g.id)}
                      className="w-5 h-5 shrink-0 cursor-pointer appearance-none rounded-lg border border-line bg-card bg-center bg-no-repeat bg-[length:12px_12px] transition-colors checked:border-brand checked:bg-brand checked:bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2016%2016%27%20fill=%27none%27%20stroke=%27white%27%20stroke-width=%272.5%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E%3Cpath%20d=%27M3%208.5l3.5%203.5L13%204.5%27/%3E%3C/svg%3E')] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-dark"
                    />
                    <span className={cuisines.has(g.id) ? 'text-ink font-semibold' : 'text-muted'}>
                      {t(`cuisineGroup.${g.id}`)}
                    </span>
                  </label>
                ))}
              </div>
              {cuisines.size > 0 && (
                <button
                  type="button"
                  onClick={() => setCuisines(new Set())}
                  className="mt-3 text-xs font-semibold text-brand"
                >
                  {t('home.resetFilter')}
                </button>
              )}
            </div>
          </aside>

          <div>
            <div className="lg:hidden px-4 pb-3 pt-3">{searchBox('search-mobile')}</div>

            <div className="lg:hidden flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
              {ratingRow}
            </div>

            <div className="lg:hidden flex gap-2 px-4 pb-4 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setCuisines(new Set())}
                aria-pressed={cuisines.size === 0}
                className={`shrink-0 inline-flex min-h-[40px] items-center px-4 rounded-full text-sm font-semibold border ${
                  cuisines.size === 0
                    ? 'bg-primary text-white border-primary'
                    : 'bg-card text-muted border-line'
                }`}
              >
                {t('home.allChip')}
              </button>
              {CUISINE_GROUPS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleCuisine(g.id)}
                  aria-pressed={cuisines.has(g.id)}
                  className={`shrink-0 inline-flex min-h-[40px] items-center px-4 rounded-full text-sm font-semibold border ${
                    cuisines.has(g.id)
                      ? 'bg-primary text-white border-primary'
                      : 'bg-card text-muted border-line'
                  }`}
                >
                  {t(`cuisineGroup.${g.id}`)}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3 lg:px-0 lg:pb-4">
              <div
                role="group"
                aria-label={t('home.viewAria')}
                className="inline-flex rounded-full border border-line bg-card p-1"
              >
                <button
                  type="button"
                  onClick={() => setView('list')}
                  aria-pressed={view === 'list'}
                  className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-colors ${
                    view === 'list'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  <ListIcon className="h-3.5 w-3.5" />
                  {t('home.viewList')}
                </button>
                <button
                  type="button"
                  onClick={showMap}
                  aria-pressed={view === 'map'}
                  className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-colors ${
                    view === 'map' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-ink'
                  }`}
                >
                  <MapIcon className="h-3.5 w-3.5" />
                  {t('home.viewMap')}
                </button>
              </div>

              <button
                type="button"
                onClick={toggleNearMe}
                aria-pressed={nearMe}
                title={t('home.nearMeHint')}
                className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full border px-4 text-xs font-semibold transition-colors ${
                  nearMe
                    ? 'border-accent-dark bg-accent-soft text-accent-dark'
                    : 'border-line bg-card text-muted hover:text-ink'
                }`}
              >
                <LocationIcon className="h-3.5 w-3.5" />
                {t('home.nearMe')}
              </button>
            </div>

            {geoState === 'locating' && (
              <p role="status" className="px-4 pb-3 text-xs font-semibold text-muted lg:px-0">
                {t('home.geoLocating')}
              </p>
            )}
            {geoState === 'denied' && (
              <p role="alert" className="px-4 pb-3 text-xs font-semibold text-danger lg:px-0">
                {t('home.geoDenied')}
              </p>
            )}
            {geoState === 'unsupported' && (
              <p role="alert" className="px-4 pb-3 text-xs font-semibold text-danger lg:px-0">
                {t('home.geoUnsupported')}
              </p>
            )}
            {geoState === 'error' && (
              <p role="alert" className="px-4 pb-3 text-xs font-semibold text-danger lg:px-0">
                {t('home.geoError')}
              </p>
            )}

            {view === 'list' ? (
              <div className="flex flex-col gap-3 px-4 lg:px-0 lg:grid lg:grid-cols-2 lg:gap-5">
                {filtered.map((r) => (
                  <RestaurantCard key={r.id} restaurant={r} now={now} distanceM={r.distanceM} />
                ))}
                {filtered.length === 0 && (
                  <div className="lg:col-span-full text-center text-muted text-sm py-12">
                    {nearActive ? t('home.mapEmpty') : t('home.emptyResults')}
                  </div>
                )}
              </div>
            ) : (
              <div className="px-4 lg:px-0">
                <Suspense
                  fallback={
                    <div className="flex h-[540px] items-center justify-center rounded-3xl border border-line bg-card lg:h-[680px]">
                      <span
                        className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand"
                        aria-hidden="true"
                      />
                    </div>
                  }
                >
                  <MapView
                    restaurants={filtered}
                    user={coords}
                    onLocate={requestLocation}
                    locating={geoState === 'locating'}
                  />
                </Suspense>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
      <InstallBanner />
    </div>
  );
}
