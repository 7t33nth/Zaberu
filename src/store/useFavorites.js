import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Избранное: храним массивы ID ресторанов и блюд в localStorage.
// Структура простая и лёгкая, сами данные заведений и блюд берутся из каталога.
export const useFavorites = create(
  persist(
    (set, get) => ({
      restaurantIds: [],
      dishIds: [],

      toggleRestaurant: (id) => {
        if (!id) return;
        const { restaurantIds } = get();
        const exists = restaurantIds.includes(id);
        set({
          restaurantIds: exists ? restaurantIds.filter((rId) => rId !== id) : [...restaurantIds, id]
        });
      },

      toggleDish: (id) => {
        if (!id) return;
        const { dishIds } = get();
        const exists = dishIds.includes(id);
        set({
          dishIds: exists ? dishIds.filter((dId) => dId !== id) : [...dishIds, id]
        });
      },

      isRestaurantFavorite: (id) => get().restaurantIds.includes(id),
      isDishFavorite: (id) => get().dishIds.includes(id),
      clear: () => set({ restaurantIds: [], dishIds: [] })
    }),
    {
      name: 'express-pickup-favorites',
      version: 1
    }
  )
);

export function useIsRestaurantFavorite(id) {
  return useFavorites((s) => s.restaurantIds.includes(id));
}

export function useIsDishFavorite(id) {
  return useFavorites((s) => s.dishIds.includes(id));
}

export function useFavoritesCount() {
  const rCount = useFavorites((s) => s.restaurantIds.length);
  const dCount = useFavorites((s) => s.dishIds.length);
  return rCount + dCount;
}
