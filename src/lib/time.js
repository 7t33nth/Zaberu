// Вся логика времени выдачи. Без зависимостей от React и браузера, чтобы её можно было тестировать в Node.

export const SLOT_MIN = 5;
export const SLOT_MS = SLOT_MIN * 60 * 1000;
export const HORIZON_MIN = 180; // на сколько вперёд показываем слоты
export const FREE_UNITS = 2; // первые 2 порции без надбавки — готовятся заодно с первой
// Сколько времени после оформления клиент может сам отменить ещё не подтверждённый заказ.
// Значение задублировано в firestore.rules (Firestore-правила не умеют импортировать JS) —
// меняя одно, меняйте и другое.
export const CANCEL_WINDOW_MS = 60000;
// Сколько ждём подтверждения получения от клиента, прежде чем кухня сможет закрыть
// заказ сама. Значение задублировано в firestore.rules (10800000) — меняя одно,
// меняйте и другое.
export const RECEIVE_GRACE_MS = 3 * 60 * 60 * 1000;

export const ceilToSlot = (ms) => Math.ceil(ms / SLOT_MS) * SLOT_MS;

export function dayKey(date = new Date()) {
  const d = new Date(date);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

export function startOfDay(ms = Date.now()) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// "10:00-23:00" -> { open: 600, close: 1380 } (минуты от полуночи). "11:00-00:00" -> close = 1440.
export function parseHours(str) {
  const m = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(str || '');
  if (!m) return { open: 0, close: 1440 };
  const open = Number(m[1]) * 60 + Number(m[2]);
  let close = Number(m[3]) * 60 + Number(m[4]);
  if (close <= open) close += 1440;
  return { open, close };
}

export function hoursForDay(hoursStr, now = Date.now()) {
  const { open, close } = parseHours(hoursStr);
  const base = startOfDay(now);
  return { openMs: base + open * 60000, closeMs: base + close * 60000 };
}

// Время до готовности заказа = самое долгое блюдо в нём (первая партия готовится вместе с ним)
// + сколько ещё "порций кухни" (по slotCapacity — реальная пропускная способность именно этой
// кухни) нужно докрутить сверх первых FREE_UNITS порций. Так большой заказ у маленькой кухни
// оценивается дольше, чем у большой, вместо одной произвольной константы на все заведения.
export function estimatePrepMinutes(lines, capacity) {
  if (!lines.length) return 0;
  const units = lines.reduce((s, l) => s + l.qty, 0);
  const longest = lines.reduce((m, l) => Math.max(m, l.dish.prepMinutes || 0), 0);
  const extraUnits = Math.max(0, units - FREE_UNITS);
  if (!extraUnits || !capacity) return longest;
  const extraBatches = Math.ceil(extraUnits / capacity);
  return longest + extraBatches * SLOT_MIN;
}

// Заведение ещё принимает заказы на сегодня?
export function ordersOpen(hoursStr, now = Date.now()) {
  const { closeMs } = hoursForDay(hoursStr, now);
  return now + 2 * SLOT_MS < closeMs;
}

export function isOpenNow(hoursStr, now = Date.now()) {
  const { openMs, closeMs } = hoursForDay(hoursStr, now);
  return now >= openMs && now < closeMs;
}

/**
 * Строит список слотов выдачи.
 *  loads    — { [slotStartMs]: занятые порции }
 *  capacity — сколько порций кухня успевает за один слот
 *  units    — сколько порций в текущем заказе
 * Слот доступен, если в него ещё помещается весь заказ.
 */
export function buildSlots({ hours, prepMinutes, loads = {}, capacity, units, now = Date.now() }) {
  const { openMs, closeMs } = hoursForDay(hours, now);
  const readyAt = Math.max(now, openMs) + prepMinutes * 60000;
  const first = ceilToSlot(readyAt);
  const last = Math.min(closeMs - SLOT_MS, first + HORIZON_MIN * 60000);
  const slots = [];
  for (let start = first; start <= last; start += SLOT_MS) {
    const used = loads[start] || 0;
    const free = Math.max(0, capacity - used);
    slots.push({
      start,
      used,
      free,
      load: Math.min(1, used / capacity),
      available: free >= units
    });
  }
  return slots;
}

export const pad2 = (n) => String(n).padStart(2, '0');

export function formatClock(ms) {
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function formatCountdown(ms) {
  const sign = ms < 0 ? '−' : '';
  const total = Math.floor(Math.abs(ms) / 1000);
  return `${sign}${Math.floor(total / 60)}:${pad2(total % 60)}`;
}

// «через 17 мин» / «через 45 с»: для клиента, без mm:ss. lang меняет только подпись единицы
// измерения — kk использует те же сокращения "мин"/"с", что и ru.
export function formatLeft(ms, lang = 'ru') {
  const abs = Math.abs(ms);
  const unitMin = lang === 'en' ? 'min' : 'мин';
  const unitSec = lang === 'en' ? 's' : 'с';
  return abs >= 60000
    ? `${Math.floor(abs / 60000)} ${unitMin}`
    : `${Math.max(1, Math.floor(abs / 1000))} ${unitSec}`;
}

export function formatMinutes(ms, lang = 'ru') {
  const m = Math.max(0, Math.round(ms / 60000));
  return `${m} ${lang === 'en' ? 'min' : 'мин'}`;
}

export const formatMoney = (n) => `${Number(n).toLocaleString('ru-RU')}\u00A0₸`;

// ru: полные падежи (порция/порции/порций). kk: после числительного существительное не
// изменяется — "порция" остаётся неизменной формой. en: обычный singular/plural.
export function pluralPortions(n, lang = 'ru') {
  if (lang === 'en') return `${n} portion${n === 1 ? '' : 's'}`;
  if (lang === 'kk') return `${n} порция`;
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return `${n} порций`;
  if (b === 1) return `${n} порция`;
  if (b >= 2 && b <= 4) return `${n} порции`;
  return `${n} порций`;
}
