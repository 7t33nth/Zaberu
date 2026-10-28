// Авторизация сотрудников кухни через Firebase Auth (email/пароль).
// Доступ к конкретному заведению определяется документом staff/{email} в Firestore —
// заводится вручную в консоли Firebase (см. README): { restaurantIds: ["r01"] }
// либо { restaurantIds: ["*"] } для доступа ко всем заведениям.
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { firebaseApp, firebaseEnabled } from './firebaseApp.js';

const auth = firebaseEnabled ? getAuth(firebaseApp) : null;
const db = firebaseEnabled ? getFirestore(firebaseApp) : null;

async function fetchAssignment(email) {
  try {
    const snap = await getDoc(doc(db, 'staff', email.toLowerCase()));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error('staff assignment lookup failed', err);
    return null;
  }
}

// cb(null) — не авторизован, cb({ email, restaurantIds }) — авторизован.
// Без настроенного Firebase (локальный режим для разработки) считаем сотрудника
// вошедшим с доступом ко всем заведениям — базы данных всё равно нет, защищать нечего.
export function onStaffAuthChange(cb) {
  if (!firebaseEnabled) {
    cb({ email: null, restaurantIds: ['*'] });
    return () => {};
  }
  return onAuthStateChanged(auth, async (user) => {
    if (!user?.email) return cb(null);
    const assignment = await fetchAssignment(user.email);
    cb({ email: user.email, restaurantIds: assignment?.restaurantIds || [] });
  });
}

export async function signInStaff(email, password) {
  if (!firebaseEnabled) return { ok: true };
  try {
    await signInWithEmailAndPassword(auth, email.trim(), password);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapAuthError(err.code) };
  }
}

export async function signOutStaff() {
  if (firebaseEnabled) await signOut(auth);
}

function mapAuthError(code) {
  switch (code) {
    case 'auth/invalid-email':
      return 'Некорректный email';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Неверный email или пароль';
    case 'auth/too-many-requests':
      return 'Слишком много попыток. Попробуйте позже';
    default:
      return 'Ошибка входа. Попробуйте снова';
  }
}
