import { useEffect, useState } from 'react';
import { doc, getFirestore, onSnapshot } from 'firebase/firestore';
import { firebaseApp } from '../lib/firebaseApp.js';
import { subscribeOrder } from '../lib/api.js';

// SVG-иконки для шагов статуса заказа
function ClipboardCheckIcon({ className = 'w-5 h-5' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  );
}

function ChefHatIcon({ className = 'w-5 h-5' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z" />
      <line x1="6" y1="17" x2="18" y2="17" />
    </svg>
  );
}

function BellRingIcon({ className = 'w-5 h-5' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      <path d="M4 2C2.8 3.7 2 5.7 2 8" />
      <path d="M22 8c0-2.3-.8-4.3-2-6" />
    </svg>
  );
}

function CheckIcon({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

const STEPS = [
  {
    key: 'pending',
    label: 'Заказ создан',
    subtitle: 'Ожидает подтверждения кухней',
    Icon: ClipboardCheckIcon
  },
  {
    key: 'cooking',
    label: 'Принят кухней',
    subtitle: 'Повар начнёт готовить ближе к указанному времени',
    Icon: ChefHatIcon
  },
  {
    key: 'ready',
    label: 'Готов к выдаче',
    subtitle: 'Можно подойти к стойке выдачи',
    Icon: BellRingIcon
  }
];

export default function OrderStatusTracker({ orderId, initialOrder = null }) {
  const [order, setOrder] = useState(initialOrder);
  const [loading, setLoading] = useState(!initialOrder);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      setError('ID заказа не указан');
      return;
    }

    setLoading(true);
    setError(null);

    // Если есть VITE_FIREBASE_PROJECT_ID — слушаем Firestore напрямую через onSnapshot,
    // иначе используем абстракцию subscribeOrder (которая также работает и в локальном режиме).
    const useDirectFirebase = Boolean(import.meta.env.VITE_FIREBASE_PROJECT_ID);

    if (useDirectFirebase) {
      try {
        const db = getFirestore(firebaseApp);
        const unsub = onSnapshot(
          doc(db, 'orders', orderId),
          (snapshot) => {
            if (snapshot.exists()) {
              setOrder({ id: snapshot.id, ...snapshot.data() });
              setError(null);
            } else {
              setOrder(null);
              setError('Заказ не найден');
            }
            setLoading(false);
          },
          (err) => {
            console.error('OrderStatusTracker Firestore error:', err);
            setError('Ошибка загрузки статуса');
            setLoading(false);
          }
        );
        return () => unsub();
      } catch (err) {
        console.error('Failed to init Firestore onSnapshot:', err);
      }
    }

    // Резервная подписка через API проекта
    const unsub = subscribeOrder(orderId, (data) => {
      if (data) {
        setOrder(data);
        setError(null);
      } else {
        setOrder(null);
        setError('Заказ не найден');
      }
      setLoading(false);
    });

    return () => unsub();
  }, [orderId]);

  if (loading && !order) {
    return (
      <div className="w-full bg-card rounded-2xl border border-line p-4 animate-pulse">
        <div className="h-4 bg-line/60 rounded w-1/3 mb-4 mx-auto" />
        <div className="flex justify-between items-center px-4">
          <div className="w-8 h-8 rounded-full bg-line/70" />
          <div className="h-1 flex-1 bg-line/40 mx-2" />
          <div className="w-8 h-8 rounded-full bg-line/50" />
          <div className="h-1 flex-1 bg-line/40 mx-2" />
          <div className="w-8 h-8 rounded-full bg-line/50" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="w-full bg-card rounded-2xl border border-line p-4 text-center">
        <p className="text-xs text-danger font-semibold">{error || 'Заказ не найден'}</p>
      </div>
    );
  }

  // Определение текущего шага
  // Дискретные статусы: pending -> cooking -> ready.
  // Если статус done, заказ уже завершён (все шаги пройдены).
  const status = order.status;
  const isDone = status === 'done';
  const isCancelled = status === 'cancelled';

  let currentStepIdx = 0;
  if (status === 'cooking') currentStepIdx = 1;
  else if (status === 'ready' || isDone) currentStepIdx = 2;

  const currentStep = STEPS[Math.min(currentStepIdx, STEPS.length - 1)];

  return (
    <div className="w-full bg-card rounded-2xl border border-line p-4 shadow-sm text-center">
      {/* Текстовый заголовок статуса */}
      <div className="mb-4">
        {isCancelled ? (
          <div>
            <div className="text-sm font-extrabold text-danger">Заказ отменён</div>
            <div className="text-xs text-muted mt-0.5">Этот заказ был отменён</div>
          </div>
        ) : isDone ? (
          <div>
            <div className="text-sm font-extrabold text-accent-dark">Заказ выдан</div>
            <div className="text-xs text-muted mt-0.5">Приятного аппетита!</div>
          </div>
        ) : (
          <div>
            <div className="text-sm font-extrabold text-ink">{currentStep.label}</div>
            <div className="text-xs text-muted mt-0.5">{currentStep.subtitle}</div>
          </div>
        )}
      </div>

      {/* Горизонтальная шкала с тремя шагами */}
      {!isCancelled && (
        <div className="relative">
          <div
            className="absolute top-4 left-0 right-0 -translate-y-1/2 h-0.5 bg-line"
            style={{ marginLeft: 'calc((100%/3)/2)', marginRight: 'calc((100%/3)/2)' }}
          >
            <div
              className="h-full bg-accent-dark transition-all duration-500 ease-out"
              style={{
                width: isDone
                  ? '100%'
                  : currentStepIdx === 0
                    ? '0%'
                    : currentStepIdx === 1
                      ? '50%'
                      : '100%'
              }}
            />
          </div>
          <div className="relative grid grid-cols-3">
            {STEPS.map((step, idx) => {
              const isCompleted = isDone || idx < currentStepIdx;
              const isCurrent = !isDone && idx === currentStepIdx;
              const Icon = step.Icon;

              return (
                <div key={step.key} className="flex flex-col items-center">
                  <div
                    className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-300 ${
                      isCompleted
                        ? 'border-accent-dark bg-accent-dark text-white'
                        : isCurrent
                          ? 'border-accent-dark bg-card text-accent-dark ring-4 ring-accent/30 animate-pulse'
                          : 'border-line bg-paper text-muted'
                    }`}
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    {isCompleted ? (
                      <CheckIcon className="w-4 h-4 stroke-[2.5] block" />
                    ) : (
                      <Icon className="w-4 h-4 block" />
                    )}
                  </div>
                  <div className="mt-2 w-full flex justify-center px-1">
                    <span
                      className={`text-[11px] font-semibold leading-tight text-center ${
                        isCurrent
                          ? 'text-ink font-bold'
                          : isCompleted
                            ? 'text-accent-dark'
                            : 'text-muted'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
