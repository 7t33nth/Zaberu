// Системные уведомления «скоро/готово» через уже зарегистрированный PWA service worker
// (vite-plugin-pwa) — работают, даже если вкладка свёрнута или открыта другая вкладка.
// ВАЖНО: это не настоящий Web Push — при полностью закрытой вкладке/браузере уведомление
// не придёт, потому что разбудить закрытую страницу может только сервер, отправляющий push
// по протоколу Push API (нужен бэкенд/Cloud Function, которого в этом проекте сознательно нет).
export function canNotify() {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

export async function ensureNotifyPermission() {
  if (!canNotify() || Notification.permission !== 'default') return;
  try {
    await Notification.requestPermission();
  } catch {
    /* игнорируем: например, запрет политикой браузера */
  }
}

// Вибрация — короткий «дзинь» в кармане. На iOS её нет, на Android есть; вызов
// без разрешения просто игнорируется, поэтому оборачиваем в try.
export function vibrate(pattern = [120, 60, 120]) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    /* не критично */
  }
}

async function showNotification(title, body) {
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification(title, {
    body,
    icon: '/icon-192.png',
    // badge — маленькая монохромная иконка в статус-баре Android. Формально нужен
    // белый силуэт на прозрачном фоне, но логотип читается и так.
    badge: '/icon-192.png',
    // Одинаковый tag не даёт уведомлениям копиться стопкой: новое заменяет старое.
    tag: 'zaberu-order',
    renotify: false
  });
}

// Показываем уведомление, только если вкладка сейчас не на виду — иначе оно дублировало
// бы уже показанный на экране toast.
export async function notifyIfHidden(title, body) {
  if (!canNotify() || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;
  try {
    await showNotification(title, body);
    vibrate();
  } catch (err) {
    console.error('showNotification failed', err);
  }
}

// Бейдж на иконке приложения: сколько заказов ждут действия. Поддерживают Chrome/Edge
// на Android и десктопе, Safari — в установленном приложении; остальные просто игнорируют.
export function setAppBadge(count) {
  try {
    if (count > 0 && navigator.setAppBadge) navigator.setAppBadge(count);
    else if (navigator.clearAppBadge) navigator.clearAppBadge();
  } catch {
    /* не критично */
  }
}

export function clearAppBadge() {
  setAppBadge(0);
}

// Для тестов и отладки: подтолкнуть то же уведомление, что увидит человек.
export async function notifyNow(title, body) {
  if (!canNotify() || Notification.permission !== 'granted') return;
  try {
    await showNotification(title, body);
    vibrate();
  } catch (err) {
    console.error('showNotification failed', err);
  }
}
