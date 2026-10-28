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

// Показываем уведомление, только если вкладка сейчас не на виду — иначе оно дублировало
// бы уже показанный на экране toast.
export async function notifyIfHidden(title, body) {
  if (!canNotify() || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, { body, icon: '/symbol.png', badge: '/symbol.png' });
  } catch (err) {
    console.error('showNotification failed', err);
  }
}
