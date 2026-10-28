// Фильтры подписок «на сегодня» (startOfDay, документ days/{id}_{yyyymmdd}) вычисляются
// один раз при создании подписки. Вкладка кухни или открытый чекаут, пережившие полночь,
// иначе продолжают слушать вчерашний день: слоты показываются вчерашние, новые заказы
// не приходят до перезагрузки страницы. Поэтому подписку пересоздаём при смене даты.
import { dayKey } from './time.js';

const CHECK_MS = 30 * 1000;

/**
 * @param {() => () => void} create создаёт подписку и возвращает функцию отписки
 * @returns {() => void} отписка
 */
export function subscribeWithDayRollover(create, { checkMs = CHECK_MS, now = Date.now } = {}) {
  let stop = create();
  let currentDay = dayKey(now());

  const timer = setInterval(() => {
    const today = dayKey(now());
    if (today === currentDay) return;
    currentDay = today;
    stop();
    stop = create();
  }, checkMs);
  // В Node таймер не должен удерживать процесс (в браузере unref нет).
  timer.unref?.();

  return () => {
    clearInterval(timer);
    stop();
  };
}
