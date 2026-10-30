// Установка PWA на домашний экран. Два разных сценария:
//  * Android/Chrome/Edge присылают событие beforeinstallprompt — по клику показываем
//    системное окно установки (это единственный способ, самодельной кнопкой «установить»
//    браузер не обойти);
//  * iOS такого API не даёт вообще, поэтому там показываем инструкцию
//    «Поделиться → На экран „Домой“».
// Событие приходит один раз и рано — иногда до монтирования React, поэтому перехватываем
// его на уровне модуля, а хук usePWAInstall подписывается на изменения этого хранилища.
import { useEffect, useState } from 'react';

const HIDE_KEY = 'ep_install_hidden_at';
const HIDE_MS = 14 * 24 * 60 * 60 * 1000; // «Позже» — не навсегда: через две недели напомним

let deferredPrompt = null;
let installedInSession = false;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Без preventDefault Chrome покажет свою мини-плашку, и наша кнопка останется без дела.
    e.preventDefault();
    deferredPrompt = e;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    installedInSession = true;
    deferredPrompt = null;
    emit();
  });
}

// Приложение уже открыто как установленное (иконка, без адресной строки)?
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    // iOS Safari не поддерживает display-mode до 16.4 и отдаёт свой флаг
    window.navigator.standalone === true
  );
}

export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // iPadOS 13+ представляется как Macintosh, но с тач-экраном — по UA его не отличить.
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function installHintHidden() {
  try {
    const at = Number(localStorage.getItem(HIDE_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < HIDE_MS;
  } catch {
    return false;
  }
}

export function hideInstallHint() {
  try {
    localStorage.setItem(HIDE_KEY, String(Date.now()));
  } catch {
    /* приватный режим — просто прячем до перезагрузки */
  }
}

// Системное окно установки. Возвращает true, если пользователь согласился.
export async function promptInstall() {
  if (!deferredPrompt) return false;
  const event = deferredPrompt;
  deferredPrompt = null; // событие одноразовое: повторный prompt() бросит ошибку
  emit();
  event.prompt();
  const choice = await event.userChoice;
  return choice.outcome === 'accepted';
}

function snapshot() {
  return {
    installed: isStandalone() || installedInSession,
    canPrompt: Boolean(deferredPrompt),
    ios: isIOS()
  };
}

// Хук для кнопок/баннеров установки. Возвращает актуальное состояние и действие prompt().
export function usePWAInstall() {
  const [state, setState] = useState(snapshot);

  useEffect(() => {
    const update = () => setState(snapshot());
    listeners.add(update);
    const mq = window.matchMedia('(display-mode: standalone)');
    mq.addEventListener?.('change', update);
    update();
    return () => {
      listeners.delete(update);
      mq.removeEventListener?.('change', update);
    };
  }, []);

  return {
    ...state,
    canInstall: !state.installed && (state.canPrompt || state.ios),
    promptInstall
  };
}
