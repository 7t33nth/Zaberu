// Общий инстанс Firebase App: и бэкенд заказов, и авторизация сотрудников должны
// использовать одно и то же приложение, иначе initializeApp() бросит ошибку о дубликате.
import { getApp, getApps, initializeApp } from 'firebase/app';

const env = import.meta.env;

export const firebaseEnabled = Boolean(env.VITE_FIREBASE_PROJECT_ID);

export const firebaseApp = firebaseEnabled
  ? getApps().length
    ? getApp()
    : initializeApp({
        apiKey: env.VITE_FIREBASE_API_KEY,
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: env.VITE_FIREBASE_PROJECT_ID,
        appId: env.VITE_FIREBASE_APP_ID
      })
  : null;
