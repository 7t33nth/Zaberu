// Заказы этого устройства: регистрации нет, поэтому «мои заказы» хранятся локально.
const KEY = 'ep_my_orders';
const ACK_KEY = 'ep_order_acks';
const ATTENTION_KEY = 'ep_order_attention';
const NAME_KEY = 'ep_name';
// История должна переживать несколько заказов: храним больше, чем показывает панель.
const MAX_ORDER_IDS = 20;

// Событие для тех, кто следит за заказами (бейдж на иконке и уведомления):
// после оформления список меняется, и подписки должны обновиться без перезагрузки.
export const MY_ORDERS_EVENT = 'ep:my-orders';

function readList(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeList(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
    window.dispatchEvent(new Event(MY_ORDERS_EVENT));
  } catch {
    /* приватный режим: не критично */
  }
}

export function getMyOrderIds() {
  return readList(KEY);
}

export function addMyOrderId(id) {
  writeList(KEY, [id, ...getMyOrderIds().filter((x) => x !== id)].slice(0, MAX_ORDER_IDS));
}

// Клиент убрал заказ из активной панели: он остаётся и в базе, и в истории заказов.
export function removeMyOrderId(id) {
  writeList(
    KEY,
    getMyOrderIds().filter((x) => x !== id)
  );
}

// «Понял(а)» / «Получил(а)»: отмечаем заказ просмотренным. Это не удаляет его
// из истории — иначе отменённые и выданные заказы навсегда пропадали бы из «Мои заказы».
export function isOrderAcknowledged(id) {
  return readList(ACK_KEY).includes(id);
}

export function acknowledgeOrder(id) {
  writeList(ACK_KEY, [id, ...readList(ACK_KEY).filter((x) => x !== id)].slice(0, 100));
  clearOrderAttention(id);
}

// Заказы, о которых пользователь ещё не знает (например, автоматически отменились,
// пока приложение было закрыто). Индикатор у «Истории заказов» живёт до просмотра.
export function getAttentionOrderIds() {
  return readList(ATTENTION_KEY).filter((id) => getMyOrderIds().includes(id));
}

export function hasOrderAttention() {
  return getAttentionOrderIds().length > 0;
}

export function markOrderAttention(id) {
  if (readList(ATTENTION_KEY).includes(id)) return;
  writeList(ATTENTION_KEY, [id, ...readList(ATTENTION_KEY)].slice(0, 100));
}

export function clearOrderAttention(id) {
  writeList(
    ATTENTION_KEY,
    readList(ATTENTION_KEY).filter((x) => x !== id)
  );
}

export function clearAllOrderAttention() {
  if (!readList(ATTENTION_KEY).length) return;
  writeList(ATTENTION_KEY, []);
}

export const getSavedName = () => {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
};

export const saveName = (name) => {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* ignore */
  }
};
