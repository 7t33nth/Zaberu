import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CATEGORY_ORDER, menu, restaurantById } from '../data/index.js';
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
import { LocationIcon, StarIcon, ArrowLeftIcon } from '../components/Icons.jsx';
import { useLang, useT } from '../lib/i18n/store.js';

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

  const dishes = useMemo(() => menu.filter((d) => d.restaurantId === id), [id]);
  const categories = useMemo(() => {
    const rank = (c) => {
      const i = CATEGORY_ORDER.indexOf(c);
      return i === -1 ? CATEGORY_ORDER.length : i;
    };
    return Array.from(new Set(dishes.map((d) => d.category))).sort((a, b) => rank(a) - rank(b));
  }, [dishes]);

  const sectionRefs = useRef({});
  const [activeDish, setActiveDish] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [conflictDish, setConflictDish] = useState(null);
  const [toast, toastNode] = useToast();

  if (!restaurant) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted">Такого заведения нет.</p>
        <Link to="/" className="inline-block mt-4 font-bold text-accent-dark">К списку заведений</Link>
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

  const otherCart = cartRestaurant && cartRestaurant !== id && Object.keys(lines).length > 0;

  return (
    <div className="pb-32 lg:pb-16">
      {toastNode}
      <div className="relative overflow-hidden bg-[#24262b] lg:rounded-3xl lg:mt-8 lg:max-w-[1200px] lg:mx-auto">
        <img
          src={`/images/${restaurant.id}/flash.webp`}
          alt=""
          aria-hidden="true"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 to-black/70" />
        <div className="relative px-4 pt-4 pb-4 lg:px-10 lg:pt-8 lg:pb-8">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label={t('menu.back')}
            className="w-9 h-9 rounded-full bg-black/40 border border-white/20 flex items-center justify-center font-bold text-white hover:border-white/50 transition-colors shadow-sm"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </button>
          <div className="mt-3 lg:mt-4">
            <h1 className="font-extrabold text-xl lg:text-3xl text-white leading-tight">{restaurant.name}</h1>
            <div className="flex items-center gap-2 text-sm lg:text-base text-white/70 mt-0.5">
              <span className="inline-flex items-center gap-1 font-bold text-white">
                <StarIcon className="w-3.5 h-3.5 text-warn" />
                <span>{restaurant.rating}</span>
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <LocationIcon className="w-3.5 h-3.5 shrink-0" />
                <span>{restaurant.address}</span>
              </span>
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
          <div role="status" className="mx-4 lg:mx-0 mb-3 rounded-xl bg-warn-soft text-warn text-sm font-semibold px-4 py-3 border border-warn/20">
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
        <div>
          <div className="sticky top-0 z-10 bg-paper flex gap-2 px-4 lg:px-0 py-3 overflow-x-auto no-scrollbar border-b border-line lg:rounded-none">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => sectionRefs.current[cat]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="shrink-0 px-4 py-2 rounded-full text-sm font-semibold bg-card border border-line text-ink hover:border-ink/40 transition-colors shadow-sm"
              >
                {t(`category.${cat}`)}
              </button>
            ))}
          </div>

          <div className="px-4 lg:px-0 flex flex-col gap-6 mt-4">
            {categories.map((cat) => (
              <section key={cat} ref={(el) => (sectionRefs.current[cat] = el)} className="scroll-mt-16">
                <h2 className="font-extrabold text-ink mb-2">{t(`category.${cat}`)}</h2>
                <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-3">
                  {dishes
                    .filter((d) => d.category === cat)
                    .map((dish) => (
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
            ))}
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
      <CheckoutSheet open={checkoutOpen} onClose={() => setCheckoutOpen(false)} restaurant={restaurant} />

      <Sheet open={Boolean(conflictDish)} onClose={() => setConflictDish(null)} label={t('menu.conflictHeading')}>
        <h2 className="font-extrabold text-lg text-ink">{t('menu.conflictHeading')}</h2>
        <p className="text-sm text-muted mt-2">
          {t('menu.conflictText', { name: restaurantById[cartRestaurant]?.name })}
        </p>
        <div className="grid grid-cols-2 gap-2 mt-5">
          <button type="button" onClick={() => setConflictDish(null)} className="py-3 rounded-xl border border-line font-bold text-ink">
            {t('menu.conflictKeep')}
          </button>
          <button type="button" onClick={switchRestaurant} className="py-3 rounded-xl bg-brand text-white font-bold">
            {t('menu.conflictSwitch')}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
