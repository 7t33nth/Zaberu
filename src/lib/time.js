// Вся логика времени выдачи. Без зависимостей от React и браузера, чтобы её можно было тестировать в Node.

export const SLOT_MIN = 5;
export const SLOT_MS = SLOT_MIN * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const HORIZON_MIN = 180; // на сколько вперёд показываем слоты
export const FREE_UNITS = 2; // первые 2 порции без надбавки — готовятся заодно с первой
// Сколько времени после оформления клиент может сам отменить ещё не подтверждённый заказ.
// Значение задублировано в firestore.rules (Firestore-правила не умеют импортировать JS) —
// меняя одно, меняйте и другое.
export const CANCEL_WINDOW_MS = 3 * 60 * 1000;
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

function windowForDay(hoursStr, dayStart) {
  const { open, close } = parseHours(hoursStr);
  return { openMs: dayStart + open * 60000, closeMs: dayStart + close * 60000 };
}

// Состояние заведения в конкретный момент. Учитываем смены, которые переходят через
// полночь (например, 12:00–02:00): после 00:00 заведение всё ещё открыто со вчерашней
// смены, хотя сегодняшняя ещё не началась.
export function serviceStatus(hoursStr, now = Date.now()) {
  const todayStart = startOfDay(now);
  const today = windowForDay(hoursStr, todayStart);
  const yesterday = windowForDay(hoursStr, todayStart - DAY_MS);

  if (now >= today.openMs && now < today.closeMs) {
    return {
      open: true,
      openMs: today.openMs,
      closeMs: today.closeMs,
      dayStart: todayStart,
      isNextDay: false
    };
  }
  if (now >= yesterday.openMs && now < yesterday.closeMs) {
    return {
      open: true,
      openMs: yesterday.openMs,
      closeMs: yesterday.closeMs,
      dayStart: todayStart - DAY_MS,
      isNextDay: false
    };
  }
  if (now < today.openMs) {
    return {
      open: false,
      openMs: today.openMs,
      closeMs: today.closeMs,
      dayStart: todayStart,
      isNextDay: false
    };
  }
  return {
    open: false,
    openMs: today.openMs + DAY_MS,
    closeMs: today.closeMs + DAY_MS,
    dayStart: todayStart + DAY_MS,
    isNextDay: true
  };
}

// Окно, для которого имеет смысл строить слоты: текущая смена, если до закрытия ещё
// можно успеть приготовить хотя бы одну порцию, иначе ближайшая следующая смена.
// Благодаря этому закрытые заведения сразу предлагают предзаказ на следующее открытие.
export function serviceWindow(hoursStr, now = Date.now(), prepMinutes = 0) {
  const status = serviceStatus(hoursStr, now);
  const prepMs = prepMinutes * 60000;

  if (status.open && now + prepMs + SLOT_MS <= status.closeMs) return status;

  // Для закрытого заведения serviceStatus уже вернул ближайшее открытие. Если же смена
  // ещё идёт, но кухня не успевает, берём следующую смену от дня текущей смены.
  const nextDayStart = status.open ? status.dayStart + DAY_MS : status.dayStart;
  const next = windowForDay(hoursStr, nextDayStart);
  return {
    open: false,
    openMs: next.openMs,
    closeMs: next.closeMs,
    dayStart: nextDayStart,
    isNextDay: startOfDay(next.openMs) > startOfDay(now)
  };
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
  const status = serviceStatus(hoursStr, now);
  if (!status.open) return false;
  return now + 2 * SLOT_MS < status.closeMs;
}

export function isOpenNow(hoursStr, now = Date.now()) {
  return serviceStatus(hoursStr, now).open;
}

/**
 * Строит список слотов выдачи.
 *  loads    — { [slotStartMs]: занятые порции }
 *  capacity — сколько порций кухня успевает за один слот
 *  units    — сколько порций в текущем заказе
 * Слот доступен, если в него ещё помещается весь заказ. Если заведение уже закрыто,
 * слоты строятся на ближайшую следующую смену (следующий рабочий день).
 */
export function buildSlots({ hours, prepMinutes, loads = {}, capacity, units, now = Date.now() }) {
  const service = serviceWindow(hours, now, prepMinutes);
  const readyAt = service.open ? now + prepMinutes * 60000 : service.openMs + prepMinutes * 60000;
  const first = ceilToSlot(readyAt);
  const last = Math.min(service.closeMs - SLOT_MS, first + HORIZON_MIN * 60000);
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
