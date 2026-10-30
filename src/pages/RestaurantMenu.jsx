import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CATEGORY_ORDER, locationsOf, menu, restaurantById } from '../data/index.js';
import DishCard from '../components/DishCard.jsx';
import ItemSheet from '../components/ItemSheet.jsx';
import CartBar from '../components/CartBar.jsx';
import CartSidebar from '../components/CartSidebar.jsx';
import CheckoutSheet from '../components/CheckoutSheet.jsx';
import Sheet from '../components/Sheet.jsx';
import Steps from '../components/Steps.jsx';
import ActiveOrderBanner from '../components/ActiveOrderBanner.jsx';
import { useToast } from '../components/Toast.jsx';
import { useCart, useCartSummary } from '../store/useCart.js';
import { hoursForDay, formatClock, ordersOpen, pluralPortions } from '../lib/time.js';
import {
  LocationIcon,
  StarIcon,
  ArrowLeftIcon,
  ChevronDownIcon,
  CheckIcon,
  HeartIcon
} from '../components/Icons.jsx';
import { useLang, useT } from '../lib/i18n/store.js';
import { useFavorites, useIsRestaurantFavorite } from '../store/useFavorites.js';

export default function RestaurantMenu() {
  const { id } = useParams();
  const navigate = useNavigate();
  const t = useT();
  const lang = useLang();
  const restaurant = restaurantById[id];

  const lines = useCart((s) => s.lines);
  const cartRestaurant = useCart((s) => s.restaurantId);
  const add = useCart((s) => s.add);
  const decrement = useCart((s) => s.decrement);
  const startNew = useCart((s) => s.startNew);
  const cartSummary = useCartSummary();

  const isRestaurantFav = useIsRestaurantFavorite(id);
  const toggleRestaurant = useFavorites((s) => s.toggleRestaurant);
  const favoriteDishIds = useFavorites((s) => s.dishIds);

  const dishes = useMemo(() => menu.filter((d) => d.restaurantId === id), [id]);
  const favoriteDishes = useMemo(
    () => dishes.filter((d) => favoriteDishIds.includes(d.id)),
    [dishes, favoriteDishIds]
  );
  const categories = useMemo(() => {
    const rank = (c) => {
      const i = CATEGORY_ORDER.indexOf(c);
      return i === -1 ? CATEGORY_ORDER.length : i;
    };
    const cats = Array.from(new Set(dishes.map((d) => d.category))).sort(
      (a, b) => rank(a) - rank(b)
    );
    if (favoriteDishes.length > 0) {
      return ['favorites', ...cats];
    }
    return cats;
  }, [dishes, favoriteDishes.length]);

  const sectionRefs = useRef({});
  const [activeDish, setActiveDish] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [conflictDish, setConflictDish] = useState(null);
  const [toast, toastNode] = useToast();
  const locations = locationsOf(id);

  if (!restaurant) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted">Такого заведения нет.</p>
        <Link to="/" className="inline-block mt-4 font-bold text-accent-dark">
          К списку заведений
        </Link>
      </div>
    );
  }

  const open = ordersOpen(restaurant.hours);
  const { closeMs } = hoursForDay(restaurant.hours);

  function handleAdd(dish) {
    const result = add(dish);
    if (result === 'conflict') setConflictDish(dish);
    if (result === 'limit') {
      toast(t('menu.limitToast', { portions: pluralPortions(restaurant.slotCapacity, lang) }));
    }
  }

  function switchRestaurant() {
    startNew(conflictDish);
    setConflictDish(null);
  }

  // Смена адреса внутри сети: у каждой точки своё меню и своя корзина (блюда привязаны
  // к id заведения), поэтому с непустой корзиной сначала честно спрашиваем.
  function chooseLocation(next) {
    if (next.id === id) {
      setAddressOpen(false);
      return;
    }
    const cart = useCart.getState();
    const hasCurrentCart = cart.restaurantId === id && Object.keys(cart.lines).length > 0;
    if (hasCurrentCart && !window.confirm(t('address.cartClear'))) return;
    if (hasCurrentCart) cart.clear();
    setAddressOpen(false);
    navigate(`/restaurant/${next.id}`);
  }

  const otherCart = cartRestaurant && cartRestaurant !== id && Object.keys(lines).length > 0;

  return (
    <div className="pb-32 lg:pb-16">
      {toastNode}
      <div className="relative overflow-hidden bg-[#24262b] lg:rounded-3xl lg:mt-8 lg:max-w-[1200px] lg:mx-auto">
        <img
          src={`/images/${restaurant.id}/flash.webp`}
          alt=""
          aria-hidden="true"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 to-black/70" />
        <div className="relative px-4 pt-4 pb-4 lg:px-10 lg:pt-8 lg:pb-8">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate('/')}
              aria-label={t('menu.back')}
              className="w-11 h-11 rounded-full bg-black/40 border border-white/20 flex items-center justify-center font-bold text-white hover:border-white/50 transition-colors shadow-sm"
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => toggleRestaurant(restaurant.id)}
              aria-label={
                isRestaurantFav ? t('favorites.removeRestaurant') : t('favorites.addRestaurant')
              }
              className="w-11 h-11 rounded-full bg-black/40 border border-white/20 flex items-center justify-center font-bold text-white hover:border-white/50 transition-colors shadow-sm"
            >
              <HeartIcon
                filled={isRestaurantFav}
                className={`w-5 h-5 ${isRestaurantFav ? 'text-danger fill-danger' : 'text-white'}`}
              />
            </button>
          </div>
          <div className="mt-3 lg:mt-4">
            <h1 className="font-extrabold text-xl lg:text-3xl text-white leading-tight">
              {restaurant.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm lg:text-base text-white/70 mt-0.5">
              <span className="inline-flex items-center gap-1 font-bold text-white">
                <StarIcon className="w-3.5 h-3.5 text-warn" />
                <span>{restaurant.rating}</span>
              </span>
              <span aria-hidden="true">·</span>
              {/* Адрес — кнопка: у сети может быть несколько точек, и менять адрес
                  удобнее прямо здесь, не возвращаясь на главную. */}
              <button
                type="button"
                onClick={() => setAddressOpen(true)}
                aria-haspopup="dialog"
                aria-label={`${restaurant.address} — ${t('address.openAria')}`}
                className="inline-flex min-w-0 items-start gap-1 text-left underline decoration-white/30 underline-offset-4 transition-colors hover:text-white hover:decoration-white/60"
              >
                <LocationIcon className="mt-0.5 w-3.5 h-3.5 shrink-0" />
                <span className="min-w-0">{restaurant.address}</span>
                <ChevronDownIcon className="mt-0.5 w-3.5 h-3.5 shrink-0" />
              </button>
            </div>
          </div>
          <div className="mt-4 lg:mt-6">
            <Steps current={1} />
          </div>
        </div>
      </div>

      <div className="pt-4 lg:max-w-[1200px] lg:mx-auto lg:px-10">
        <ActiveOrderBanner />
      </div>

      <div className="lg:max-w-[1200px] lg:mx-auto lg:px-10">
        {!open && (
          <div
            role="status"
            className="mx-4 lg:mx-0 mb-3 rounded-xl bg-warn-soft text-warn text-sm font-semibold px-4 py-3 border border-warn/20"
          >
            {t('menu.closedNotice', { time: formatClock(closeMs) })}
          </div>
        )}
        {otherCart && (
          <div className="mx-4 lg:mx-0 mb-3 rounded-xl bg-paper border border-line text-sm text-muted px-4 py-3">
            {t('menu.otherCartNotice', { name: restaurantById[cartRestaurant]?.name })}
          </div>
        )}
      </div>

      <div className="lg:max-w-[1200px] lg:mx-auto lg:px-10 lg:grid lg:grid-cols-[1fr_340px] lg:gap-10 lg:items-start">
        <div className="min-w-0">
          <div className="sticky top-0 z-10 bg-paper flex gap-2 px-4 lg:px-0 py-3 overflow-x-auto no-scrollbar border-b border-line lg:rounded-none">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() =>
                  sectionRefs.current[cat]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
                className={`shrink-0 inline-flex min-h-[40px] items-center px-4 rounded-full text-sm font-semibold border transition-colors shadow-sm ${
                  cat === 'favorites'
                    ? 'bg-accent-soft text-accent-dark border-accent-dark/30 hover:border-accent-dark'
                    : 'bg-card border-line text-ink hover:border-ink/40'
                }`}
              >
                {cat === 'favorites' ? `❤️ ${t('category.favorites')}` : t(`category.${cat}`)}
              </button>
            ))}
          </div>

          <div className="px-4 lg:px-0 flex flex-col gap-6 mt-4">
            {categories.map((cat) => {
              const categoryDishes =
                cat === 'favorites' ? favoriteDishes : dishes.filter((d) => d.category === cat);
              return (
                <section
                  key={cat}
                  ref={(el) => (sectionRefs.current[cat] = el)}
                  className="scroll-mt-16"
                >
                  <h2 className="font-extrabold text-ink mb-2">
                    {cat === 'favorites' ? `❤️ ${t('category.favorites')}` : t(`category.${cat}`)}
                  </h2>
                  <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-3">
                    {categoryDishes.map((dish) => (
                      <DishCard
                        key={dish.id}
                        dish={dish}
                        qty={cartRestaurant === id ? lines[dish.id] || 0 : 0}
                        disabled={!open}
                        onOpen={setActiveDish}
                        onAdd={handleAdd}
                        onDecrement={decrement}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <div className="hidden lg:block lg:sticky lg:top-6">
          <CartSidebar
            lines={cartRestaurant === id ? cartSummary.lines : []}
            total={cartSummary.total}
            units={cartSummary.units}
            onInc={handleAdd}
            onDec={decrement}
            onCheckout={() => setCheckoutOpen(true)}
            disabled={!open}
          />
        </div>
      </div>

      <ItemSheet
        dish={activeDish}
        qty={activeDish && cartRestaurant === id ? lines[activeDish.id] || 0 : 0}
        disabled={!open}
        onClose={() => setActiveDish(null)}
        onAdd={handleAdd}
        onDecrement={decrement}
      />

      <div className="lg:hidden">
        <CartBar restaurantId={id} onNext={() => setCheckoutOpen(true)} />
      </div>
      <CheckoutSheet
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        restaurant={restaurant}
      />

      <Sheet
        open={Boolean(conflictDish)}
        onClose={() => setConflictDish(null)}
        label={t('menu.conflictHeading')}
      >
        <h2 className="font-extrabold text-lg text-ink">{t('menu.conflictHeading')}</h2>
        <p className="text-sm text-muted mt-2">
          {t('menu.conflictText', { name: restaurantById[cartRestaurant]?.name })}
        </p>
        <div className="grid grid-cols-2 gap-2 mt-5">
          <button
            type="button"
            onClick={() => setConflictDish(null)}
            className="py-3 rounded-xl border border-line font-bold text-ink"
          >
            {t('menu.conflictKeep')}
          </button>
          <button
            type="button"
            onClick={switchRestaurant}
            className="py-3 rounded-xl bg-brand text-white font-bold"
          >
            {t('menu.conflictSwitch')}
          </button>
        </div>
      </Sheet>

      <Sheet
        open={addressOpen}
        onClose={() => setAddressOpen(false)}
        label={t('address.title', { name: restaurant.name })}
      >
        <h2 className="font-extrabold text-lg text-ink">
          {t('address.title', { name: restaurant.name })}
        </h2>
        <p className="text-sm text-muted mt-1">{t('address.hint')}</p>
        <div className="mt-4 flex flex-col gap-2">
          {locations.map((loc) => {
            const selected = loc.id === id;
            return (
              <button
                key={loc.id}
                type="button"
                onClick={() => chooseLocation(loc)}
                aria-pressed={selected}
                className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                  selected
                    ? 'border-accent bg-accent-soft'
                    : 'border-line bg-paper hover:border-ink/30'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    selected ? 'border-accent-dark bg-accent text-primary' : 'border-line bg-card'
                  }`}
                >
                  {selected && <CheckIcon className="w-3 h-3" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-ink">{loc.address}</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    ★ {loc.rating} · {loc.hours}
                  </span>
                </span>
                {selected && (
                  <span className="ml-auto shrink-0 self-center text-xs font-semibold text-accent-dark">
                    {t('address.selected')}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {locations.length < 2 && <p className="mt-3 text-xs text-muted">{t('address.onlyOne')}</p>}
      </Sheet>
    </div>
  );
}
