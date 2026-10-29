// Заказы этого устройства: регистрации нет, поэтому «мои заказы» хранятся локально.
const KEY = 'ep_my_orders';
const NAME_KEY = 'ep_name';

// Событие для тех, кто показывает счётчик заказов (бейдж на иконке приложения):
// после оформления список меняется, и подписки должны обновиться без перезагрузки.
export const MY_ORDERS_EVENT = 'ep:my-orders';

export function getMyOrderIds() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

export function addMyOrderId(id) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify([id, ...getMyOrderIds().filter((x) => x !== id)].slice(0, 5))
    );
    window.dispatchEvent(new Event(MY_ORDERS_EVENT));
  } catch {
    /* приватный режим: не критично */
  }
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
