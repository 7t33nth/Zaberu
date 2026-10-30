import Sheet from './Sheet.jsx';
import QtyControl from './QtyControl.jsx';
import Thumb from './Thumb.jsx';
import { HeartIcon } from './Icons.jsx';
import { formatMoney } from '../lib/time.js';
import { useT } from '../lib/i18n/store.js';
import { useFavorites, useIsDishFavorite } from '../store/useFavorites.js';

export default function ItemSheet({ dish, qty, disabled, onClose, onAdd, onDecrement }) {
  const t = useT();
  const isFavorite = useIsDishFavorite(dish?.id);
  const toggleDish = useFavorites((s) => s.toggleDish);
  return (
    <Sheet open={Boolean(dish)} onClose={onClose} label={dish?.name || t('item.defaultLabel')}>
      {dish && (
        <>
          <div className="relative mb-4">
            <Thumb src={dish.image} className="h-48 rounded-2xl border border-line" />
            <button
              type="button"
              onClick={() => toggleDish(dish.id)}
              aria-label={isFavorite ? t('favorites.removeDish') : t('favorites.addDish')}
              className="absolute top-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm border border-white/20 text-white transition-transform hover:scale-110 active:scale-95"
            >
              <HeartIcon
                filled={isFavorite}
                className={`h-4 w-4 ${isFavorite ? 'text-danger fill-danger' : 'text-white'}`}
              />
            </button>
          </div>
          <h2 className="font-extrabold text-xl text-ink">{dish.name}</h2>
          {dish.description && <p className="text-muted text-sm mt-1">{dish.description}</p>}
          <div className="text-xs text-muted mt-2">
            {[dish.weight, t('item.prepTime', { min: dish.prepMinutes })]
              .filter(Boolean)
              .join(' · ')}
          </div>
          {dish.allergens?.length > 0 && (
            <div className="mt-2 text-xs text-muted">
              {t('item.allergensLabel')}: {dish.allergens.map((a) => t(`allergen.${a}`)).join(', ')}
            </div>
          )}

          <div className="mt-5">
            {qty > 0 ? (
              <div className="flex items-center justify-between">
                <QtyControl
                  size="lg"
                  qty={qty}
                  onInc={() => onAdd(dish)}
                  onDec={() => onDecrement(dish.id)}
                  disabled={disabled}
                />
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-brand text-white font-bold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
                >
                  {t('item.done')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onAdd(dish);
                }}
                disabled={disabled}
                className="w-full bg-brand text-white font-bold py-4 rounded-xl hover:opacity-90 transition-opacity disabled:cursor-not-allowed"
              >
                {t('item.add', { price: formatMoney(dish.price) })}
              </button>
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}
