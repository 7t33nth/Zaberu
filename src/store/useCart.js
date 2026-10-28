import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dishById, restaurantById } from '../data/index.js';
import { estimatePrepMinutes } from '../lib/time.js';

export const MAX_PER_DISH = 10;

const sum = (lines) => Object.values(lines).reduce((s, q) => s + q, 0);

// lines: { [dishId]: qty }. Храним только id и количество: цены и наличие всегда берутся из актуального меню.
export const useCart = create(
  persist(
    (set, get) => ({
      restaurantId: null,
      lines: {},

      // 'ok' | 'conflict' (в корзине другое заведение) | 'limit' (кухня не успеет столько порций)
      add: (dish) => {
        const { restaurantId, lines } = get();
        if (restaurantId && restaurantId !== dish.restaurantId && sum(lines) > 0) return 'conflict';
        const capacity = restaurantById[dish.restaurantId].slotCapacity;
        if (sum(lines) + 1 > capacity || (lines[dish.id] || 0) >= MAX_PER_DISH) return 'limit';
        set({ restaurantId: dish.restaurantId, lines: { ...lines, [dish.id]: (lines[dish.id] || 0) + 1 } });
        return 'ok';
      },

      decrement: (dishId) => {
        const lines = { ...get().lines };
        if (!lines[dishId]) return;
        if (lines[dishId] <= 1) delete lines[dishId];
        else lines[dishId] -= 1;
        set({ lines, restaurantId: Object.keys(lines).length ? get().restaurantId : null });
      },

      startNew: (dish) => set({ restaurantId: dish.restaurantId, lines: { [dish.id]: 1 } }),
      clear: () => set({ restaurantId: null, lines: {} })
    }),
    { name: 'express-pickup-cart', version: 1 }
  )
);

export function useCartSummary() {
  const restaurantId = useCart((s) => s.restaurantId);
  const lines = useCart((s) => s.lines);
  return useMemo(() => {
    const list = Object.entries(lines)
      .map(([id, qty]) => ({ dish: dishById[id], qty }))
      .filter((l) => l.dish && l.dish.available);
    const capacity = restaurantId ? restaurantById[restaurantId]?.slotCapacity : undefined;
    return {
      restaurantId,
      lines: list,
      units: list.reduce((s, l) => s + l.qty, 0),
      total: list.reduce((s, l) => s + l.qty * l.dish.price, 0),
      prepMinutes: estimatePrepMinutes(list, capacity)
    };
  }, [restaurantId, lines]);
}
