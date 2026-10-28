// Данные заведений и меню. Исходник — ../../public/data/*.json из корня репозитория
// (датасет 18 заведений Алматы). Здесь он приводится к форме, которую ждёт приложение:
// hours в виде "HH:MM-HH:MM", slotCapacity, code для номера заказа, координаты, эмодзи-заглушки.
import rawRestaurants from './restaurants.json';
import rawMenu from './menu.json';

export const DEFAULT_SLOT_CAPACITY = 4;

// Сколько порций кухня реально успевает выдать за один слот (5 мин) — по типу заведения:
// сети фастфуда с конвейерным приготовлением берут больше, места с готовкой на заказ — меньше.
// Без этого лимита пропускная способность ничем не ограничена и демо не показывает эффект.
const SLOT_CAPACITY = {
  r01: 5, // Burger King — конвейер
  r02: 5, // Wendy's — конвейер
  r03: 3, // NAVAT — казахская кухня, готовка на заказ
  r04: 3, // Ocean Basket — суши/морепродукты
  r05: 4, // Teadot
  r06: 3, // Smug BBQ Bar — стейки, долго
  r07: 5, // Six Coffee+Wine — кофейня
  r08: 4, // Bahandi
  r09: 3, // Qaganat — домашняя выпечка
  r10: 3, // Ramen 77 — рамен на заказ
  r11: 4, // Seoul chicken grill
  r12: 4, // Mamma Mia — пицца/паста
  r13: 4, // Halal Slice — пицца
  r14: 5, // Starbucks — кофейня
  r15: 5, // Ecokebab — шаурма
  r16: 5, // Gippo Doner Салем — донер
  r17: 3, // PlovmasterKz — плов, долго
  r18: 3 // FAIZ — восточная кухня
};

// Координаты точек (из сырых данных каталога, data/raw/rNN.json -> catalog...address.location).
const COORDS = {
  r01: [43.264057, 76.929463],
  r02: [43.264112, 76.929592],
  r03: [43.263265, 76.942034],
  r04: [43.256364, 76.945076],
  r05: [43.260586, 76.941153],
  r06: [43.261971, 76.947936],
  r07: [43.253528, 76.948007],
  r08: [43.313923, 77.023],
  r09: [43.319245, 76.917204],
  r10: [43.250291, 76.949777],
  r11: [43.260428, 76.927876],
  r12: [43.254198, 76.932152],
  r13: [43.251427, 76.900819],
  r14: [43.264112, 76.929592],
  r15: [43.259352, 76.942447],
  r16: [43.300857, 76.897208],
  r17: [43.29549, 76.973052],
  r18: [43.31769, 76.899112]
};

// "с 10:00 до 23:45" + hoursStructured -> "10:00-23:45" (формат для lib/time.js).
function toHoursString(r) {
  const h = r.hoursStructured?.[0];
  if (h?.open && h?.close) return `${h.open}-${h.close}`;
  const m = /(\d{1,2}:\d{2})\D+(\d{1,2}:\d{2})/.exec(r.hours || '');
  return m ? `${m[1]}-${m[2]}` : '00:00-24:00';
}

// Префикс номера заказа: первая латинская буква названия, при совпадении — добавляем следующую.
function makeCodes(list) {
  const used = new Set();
  return list.map((r) => {
    const letters = r.name.toUpperCase().replace(/[^A-ZА-Я]/g, '') || r.id.toUpperCase();
    let code = letters[0];
    for (let i = 1; used.has(code) && i < letters.length; i++) code += letters[i];
    if (used.has(code)) code = r.id.toUpperCase();
    used.add(code);
    return code;
  });
}

const codes = makeCodes(rawRestaurants);

export const restaurants = rawRestaurants.map((r, i) => {
  const [lat, lon] = COORDS[r.id] || [];
  return {
    ...r,
    address: r.address.replace(/^Казахстан,\s*Алматы,\s*/i, ''),
    hours: toHoursString(r),
    hoursText: r.hours,
    code: codes[i],
    slotCapacity: r.slotCapacity ?? SLOT_CAPACITY[r.id] ?? DEFAULT_SLOT_CAPACITY,
    lat,
    lon
  };
});

export const menu = rawMenu.map((d) => ({
  ...d,
  description: d.description || '',
  allergens: d.allergens || [],
  dietary: d.dietary || []
}));

export const restaurantById = Object.fromEntries(restaurants.map((r) => [r.id, r]));
export const dishById = Object.fromEntries(menu.map((d) => [d.id, d]));

// Кухни в датасете уже на русском; карта оставлена для обратной совместимости со slug-ами.
export const CUISINE_LABELS = {
  burgers: 'Бургеры',
  american: 'Американская',
  japanese: 'Японская',
  sushi: 'Суши',
  kazakh: 'Казахская',
  central_asian: 'Центральноазиатская'
};

// В сыром датасете почти два десятка узких тегов кухни (Пицца, Паста, Итальянская — по сути
// один фильтр). Для фильтра на главной объединяем их в несколько понятных групп, чтобы не
// listать пользователю простыню чекбоксов. Карточка заведения по-прежнему показывает исходные
// теги как есть — группировка касается только выбора ресторана.
export const CUISINE_GROUPS = [
  { id: 'burgers', label: 'Бургеры и фастфуд', tags: ['Бургеры', 'Фастфуд'] },
  { id: 'pizza', label: 'Пицца и паста', tags: ['Пицца', 'Паста', 'Итальянская'] },
  {
    id: 'asian',
    label: 'Суши и азиатская',
    tags: ['Суши', 'Японская', 'Китайская', 'Корейская', 'Морепродукты']
  },
  {
    id: 'central-asian',
    label: 'Казахская и восточная',
    tags: ['Казахская', 'Восточная', 'Узбекская', 'Уйгурская']
  },
  { id: 'grill', label: 'Шашлык и гриль', tags: ['Шашлык', 'Стейки', 'Донер', 'Шаурма'] },
  {
    id: 'cafe',
    label: 'Кофе и выпечка',
    tags: ['Кофейня', 'Кофе', 'Выпечка', 'Кондитерская', 'Домашняя']
  }
];

export const CATEGORY_LABELS = {
  breakfast: 'Завтраки',
  boxes: 'Сеты и боксы',
  burgers: 'Бургеры',
  pizza: 'Пицца',
  mains: 'Основные блюда',
  soups: 'Супы',
  salads: 'Салаты',
  appetizers: 'Закуски',
  desserts: 'Десерты',
  drinks: 'Напитки',
  extras: 'Дополнительно'
};

// Порядок категорий в меню заведения.
export const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);
