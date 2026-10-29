import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { restaurants, restaurantById } from '../data/index.js';
import {
  canReset,
  cancelOrderByStaff,
  clearDoneOrders,
  markDone,
  markReady,
  resetAll,
  seedDemoOrders,
  subscribeOrders,
  backendName
} from '../lib/api.js';
import { BASELINE_WAIT_MIN, TARGET_WAIT_MIN, computeMetrics } from '../lib/metrics.js';
import { formatClock, formatCountdown, RECEIVE_GRACE_MS } from '../lib/time.js';
import ThemeToggle from '../components/ThemeToggle.jsx';
import LangSwitch from '../components/LangSwitch.jsx';
import { ChatIcon } from '../components/Icons.jsx';
import { useToast } from '../components/Toast.jsx';
import { onStaffAuthChange, signInStaff, signOutStaff } from '../lib/staffAuth.js';
import { allowedRestaurantsFor, isRestaurantAllowed } from '../lib/staffAccess.js';
import { useLang, useT } from '../lib/i18n/store.js';

function formatWait(ms, lang = 'ru') {
  if (ms == null) return '—';
  const s = Math.round(ms / 1000);
  const unitMin = lang === 'en' ? 'min' : 'мин';
  const unitSec = lang === 'en' ? 's' : 'с';
  return s < 60
    ? `${s} ${unitSec}`
    : `${Math.floor(s / 60)} ${unitMin} ${String(s % 60).padStart(2, '0')} ${unitSec}`;
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    /* звук недоступен: не критично */
  }
}

function LoginGate() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!email.trim() || !password || busy) return;
    setBusy(true);
    setError('');
    const result = await signInStaff(email, password);
    if (!result.ok) setError(result.error);
    setBusy(false);
  }

  return (
    <div className="min-h-dvh bg-paper text-ink flex items-center justify-center p-6">
      <div className="absolute top-4 right-4">
        <LangSwitch />
      </div>
      <form onSubmit={submit} className="w-full max-w-xs">
        <h1 className="font-extrabold text-2xl">{t('admin.title')}</h1>
        <p className="text-muted text-sm mt-1">{t('admin.loginSubtitle')}</p>
        <input
          type="email"
          autoComplete="username"
          autoFocus
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError('');
          }}
          placeholder="Email"
          disabled={busy}
          className="mt-4 w-full bg-card border border-line rounded-xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-accent-dark"
        />
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError('');
          }}
          placeholder={t('admin.passwordPlaceholder')}
          disabled={busy}
          className="mt-3 w-full bg-card border border-line rounded-xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-accent-dark"
        />
        {error && (
          <p role="alert" className="text-danger text-sm mt-2">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !email.trim() || !password}
          className="mt-4 w-full bg-accent text-primary font-bold py-3 rounded-xl disabled:opacity-50"
        >
          {busy ? t('admin.checking') : t('admin.signIn')}
        </button>
        <Link to="/" className="block text-center text-muted text-sm mt-6">
          {t('admin.backToClient')}
        </Link>
      </form>
    </div>
  );
}

function NoAccessGate({ email }) {
  const t = useT();
  return (
    <div className="min-h-dvh bg-paper text-ink flex items-center justify-center p-6">
      <div className="w-full max-w-xs text-center">
        <h1 className="font-extrabold text-2xl">{t('admin.noAccessHeading')}</h1>
        <p className="text-muted text-sm mt-2">{t('admin.noAccessText', { email })}</p>
        <button
          type="button"
          onClick={signOutStaff}
          className="mt-6 w-full bg-card border border-line rounded-xl px-4 py-3 font-semibold"
        >
          {t('admin.signOutTryAnother')}
        </button>
        <Link to="/" className="block text-center text-muted text-sm mt-6">
          {t('admin.backToClient')}
        </Link>
      </div>
    </div>
  );
}

function Metric({ label, value, hint, tone }) {
  return (
    <div className="rounded-2xl bg-card border border-line p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-2xl font-extrabold mt-1 ${tone || ''}`}>{value}</div>
      {hint && <div className="text-xs text-muted mt-1">{hint}</div>}
    </div>
  );
}

function OrderCard({ order, now, onReady, onDone, onCancel, t }) {
  const msLeft = order.pickupAt - now;
  const ready = order.status === 'ready';
  const urgent = !ready && msLeft < 3 * 60000;
  // «Выдано» доступно только после подтверждения клиента (кнопка на странице заказа).
  // Если клиент так и не ответил, через RECEIVE_GRACE_MS после заявленного времени
  // подтверждение считается автоматическим — иначе очередь из «мёртвых» заказов
  // никогда не закрыть без Cloud Functions.
  const autoConfirmAt = order.pickupAt + RECEIVE_GRACE_MS;
  const autoConfirmed = !order.receivedAt && now >= autoConfirmAt;
  const canIssue = Boolean(order.receivedAt) || autoConfirmed;
  return (
    <div
      className={`rounded-2xl p-4 border flex flex-col gap-3 ${
        order.arrivedAt
          ? 'border-accent bg-accent-soft'
          : urgent
            ? 'border-danger bg-danger-soft'
            : 'border-line bg-card'
      }`}
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="text-3xl font-extrabold">{order.code}</div>
          <div className="text-xs text-muted mt-0.5">
            {order.name || t('admin.noName')} ·{' '}
            {order.pay === 'kaspi' ? t('admin.paidKaspi') : t('admin.paidOnline')}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted">
            {t('admin.pickupAt', { time: formatClock(order.pickupAt) })}
          </div>
          <div
            className={`text-lg font-bold ${msLeft < 0 ? 'text-danger' : urgent ? 'text-warn' : 'text-ink'}`}
          >
            {formatCountdown(msLeft)}
          </div>
        </div>
      </div>
      {order.arrivedAt && (
        <div className="text-xs font-bold text-accent-dark">{t('admin.customerHere')}</div>
      )}
      {ready && order.receivedAt && (
        <div className="text-xs font-bold text-accent-dark">{t('admin.receivedByClient')}</div>
      )}
      {ready && !order.receivedAt && (
        <div className={`text-xs font-semibold ${autoConfirmed ? 'text-warn' : 'text-muted'}`}>
          {autoConfirmed
            ? t('admin.receivedAuto')
            : t('admin.awaitingReceived', { time: formatClock(autoConfirmAt) })}
        </div>
      )}
      <ul className="text-sm text-muted flex flex-col gap-0.5">
        {order.items.map((it) => (
          <li key={it.id}>
            <b className="text-ink">{it.qty}×</b> {it.name}
          </li>
        ))}
      </ul>
      {order.comment && (
        <div className="flex items-center gap-1.5 text-xs text-warn bg-warn-soft rounded-lg px-2.5 py-1.5">
          <ChatIcon className="w-3.5 h-3.5 text-warn shrink-0" />
          <span>{order.comment}</span>
        </div>
      )}
      {ready ? (
        <button
          type="button"
          onClick={() => onDone(order.id)}
          disabled={!canIssue}
          title={canIssue ? undefined : t('admin.receivedLocked')}
          className="bg-accent text-primary font-bold py-3 rounded-xl transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('admin.markDoneBtn')}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onReady(order.id)}
          className="bg-primary text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity"
        >
          {t('item.done')}
        </button>
      )}
      <button
        type="button"
        onClick={() => onCancel(order.id)}
        className="self-start inline-flex min-h-[36px] items-center px-2 -mx-2 rounded-lg text-xs font-semibold text-muted hover:text-danger transition-colors"
      >
        {t('admin.cancelOrder')}
      </button>
    </div>
  );
}

function Board({ staff, allowedRestaurants }) {
  const { restaurantId: paramId } = useParams();
  const navigate = useNavigate();
  const t = useT();
  const lang = useLang();
  const [toast, toastNode] = useToast();
  const allowedId = (id) => isRestaurantAllowed(staff.restaurantIds, id);
  // allowedRestaurants не пуст: AdminBoard не пускает сюда, если доступа нет ни к одному
  // заведению каталога (например, в staff/{email} опечатка в id).
  const restaurantId =
    allowedId(paramId) && restaurantById[paramId] ? paramId : allowedRestaurants[0].id;

  // неизвестный/пустой/чужой :restaurantId в адресе — подставляем первое разрешённое заведение и чиним ссылку
  useEffect(() => {
    if (paramId !== restaurantId) navigate(`/staff/${restaurantId}`, { replace: true });
  }, [paramId, restaurantId, navigate]);

  const setRestaurantId = (id) => navigate(`/staff/${id}`);
  const [orders, setOrders] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [sound, setSound] = useState(false);
  const [query, setQuery] = useState(''); // поиск/сканирование по номеру заказа
  const seen = useRef(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const allowedIds = useMemo(() => allowedRestaurants.map((r) => r.id), [allowedRestaurants]);

  useEffect(() => {
    return subscribeOrders(allowedIds, (list) => {
      const ids = new Set(list.map((o) => o.id));
      if (seen.current && soundRef.current && [...ids].some((id) => !seen.current.has(id))) beep();
      seen.current = ids;
      setOrders(list);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedIds.join(',')]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const restaurant = restaurantById[restaurantId];
  // только заказы ВЫБРАННОГО заведения — метрики, слоты и все три колонки строятся от этого фильтра
  const mine = useMemo(
    () => orders.filter((o) => o.restaurantId === restaurantId),
    [orders, restaurantId]
  );
  const metrics = useMemo(
    () => computeMetrics(mine, { capacity: restaurant.slotCapacity, now }),
    // пересчёт раз в 15 с достаточно
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mine, restaurant, Math.floor(now / 15000)]
  );

  const q = query.trim().toLowerCase();
  const matchesQuery = (o) => !q || o.code.toLowerCase().includes(q);

  const cooking = mine
    .filter((o) => o.status === 'pending' && matchesQuery(o))
    .sort((a, b) => a.pickupAt - b.pickupAt);
  const ready = mine
    .filter((o) => o.status === 'ready' && matchesQuery(o))
    .sort((a, b) => a.pickupAt - b.pickupAt);
  const done = mine
    .filter((o) => o.status === 'done')
    .sort((a, b) => b.issuedAt - a.issuedAt)
    .slice(0, 6);

  const waitTone =
    metrics.avgWaitMs == null
      ? ''
      : metrics.avgWaitMs <= TARGET_WAIT_MIN * 60000
        ? 'text-accent-dark'
        : metrics.avgWaitMs <= (BASELINE_WAIT_MIN * 60000) / 2
          ? 'text-warn'
          : 'text-danger';

  // Ошибки записи раньше уходили в никуда: кнопка выглядела «мёртвой», причина — только
  // в консоли. Показываем короткое сообщение, детали оставляем в консоли.
  async function run(action) {
    try {
      await action();
    } catch (err) {
      console.error(err);
      toast(t('admin.actionFailed'));
    }
  }

  async function clearStats() {
    if (!window.confirm(t('admin.clearStatsConfirm', { name: restaurant.name }))) return;
    run(() => clearDoneOrders(restaurantId));
  }

  async function prepForDemo() {
    if (!window.confirm(t('admin.prepDemoConfirm', { name: restaurant.name }))) return;
    run(async () => {
      await resetAll();
      await seedDemoOrders(restaurantId);
    });
  }

  function cancelWithConfirm(id) {
    if (!window.confirm(t('admin.cancelConfirm'))) return;
    run(() => cancelOrderByStaff(id));
  }

  // markReady/markDone раньше вызывались из карточки напрямую: отказ Firestore (например,
  // заказ уже отменён) давал необработанный reject, и кнопка просто не реагировала.
  const readyOrder = (id) => run(() => markReady(id));
  const doneOrder = (id) => run(() => markDone(id));

  return (
    <div className="min-h-dvh bg-paper text-ink">
      {toastNode}
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-line">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <h1 className="font-extrabold text-xl shrink-0">{t('admin.title')}</h1>
          {allowedRestaurants.length > 1 ? (
            <label className="flex items-center gap-2 text-sm text-muted">
              <span>{t('admin.restaurantLabel')}</span>
              <select
                value={restaurantId}
                onChange={(e) => setRestaurantId(e.target.value)}
                className="bg-card border border-line text-ink font-semibold text-base sm:text-sm rounded-lg px-3 py-1.5 outline-none max-w-[55vw] sm:max-w-none focus:ring-2 focus:ring-accent-dark"
              >
                {allowedRestaurants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="text-sm font-semibold text-ink">{restaurant.name}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-muted">
          <label className="flex items-center gap-2">
            <span className="sr-only">{t('admin.searchByCodeAria')}</span>
            <input
              type="text"
              inputMode="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('admin.searchByCodePlaceholder')}
              className="bg-card border border-line rounded-lg px-3 py-1.5 text-base sm:text-sm text-ink placeholder:text-muted outline-none focus:ring-2 focus:ring-accent-dark w-44"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setSound((v) => !v);
              if (!sound) beep();
            }}
            aria-pressed={sound}
            className={`inline-flex min-h-[40px] items-center ${sound ? 'text-accent-dark font-semibold' : ''}`}
          >
            {sound ? t('admin.soundOn') : t('admin.soundOff')}
          </button>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent" />
            {backendName === 'firebase' ? t('admin.sharedDb') : t('admin.localMode')}
          </span>
          <Link to="/" className="inline-flex min-h-[40px] items-center hover:text-ink">
            {t('admin.clientSide')}
          </Link>
          <LangSwitch />
          <ThemeToggle />
          {staff.email && (
            <span className="flex items-center gap-2">
              <span className="text-muted">{staff.email}</span>
              <button type="button" onClick={signOutStaff} className="hover:text-ink">
                {t('admin.signOut')}
              </button>
            </span>
          )}
        </div>
      </header>

      {backendName !== 'firebase' && (
        <div className="bg-warn-soft text-warn text-sm font-semibold px-6 py-2.5 border-b border-warn/20">
          {t('admin.localModeHint')}
        </div>
      )}

      <main className="p-6 flex flex-col gap-6">
        <section
          aria-label={t('admin.metricsAria')}
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}
        >
          <Metric
            label={t('admin.avgWait')}
            value={formatWait(metrics.avgWaitMs, lang)}
            tone={waitTone}
            hint={t('admin.avgWaitHint', { baseline: BASELINE_WAIT_MIN, target: TARGET_WAIT_MIN })}
          />
          <Metric
            label={t('admin.onTarget')}
            value={
              metrics.onTargetShare == null ? '—' : `${Math.round(metrics.onTargetShare * 100)}%`
            }
            hint={t('admin.onTargetHint', { count: metrics.doneCount })}
          />
          <Metric
            label={t('admin.issuedLastHour')}
            value={metrics.issuedLastHour}
            hint={t('admin.ordersUnit')}
          />
          <Metric
            label={t('admin.peakLoad')}
            value={`${Math.round(metrics.peakLoad * 100)}%`}
            hint={t('admin.peakLoadHint', { capacity: restaurant.slotCapacity })}
          />
        </section>

        <section
          aria-label={t('admin.slotsAria')}
          className="rounded-2xl bg-card border border-line p-4"
        >
          <div className="text-xs text-muted mb-3">{t('admin.slotsHeading')}</div>
          <div className="flex items-end gap-2 h-24 overflow-x-auto no-scrollbar pb-1">
            {metrics.slots.map((s) => (
              <div
                key={s.start}
                className="flex-1 min-w-[24px] flex flex-col items-center gap-1 h-full justify-end"
              >
                <div
                  title={`${formatClock(s.start)}: ${s.used}/${restaurant.slotCapacity}`}
                  className={`w-full rounded-t ${s.load >= 1 ? 'bg-danger' : s.load >= 0.7 ? 'bg-warn' : 'bg-accent'}`}
                  style={{ height: `${Math.max(4, s.load * 100)}%`, opacity: s.used ? 1 : 0.25 }}
                />
                <span className="text-[10px] text-muted">{formatClock(s.start)}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-label={t('admin.cookingAria')}>
            <h2 className="font-bold mb-3">
              {t('admin.cooking')} · {cooking.length}
            </h2>
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}
            >
              {cooking.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  now={now}
                  onReady={readyOrder}
                  onDone={doneOrder}
                  onCancel={cancelWithConfirm}
                  t={t}
                />
              ))}
            </div>
            {cooking.length === 0 && <p className="text-muted text-sm">{t('admin.noCooking')}</p>}
          </section>

          <section aria-label={t('admin.readyAria')}>
            <h2 className="font-bold mb-3">
              {t('admin.waitingClient')} · {ready.length}
            </h2>
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}
            >
              {ready.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  now={now}
                  onReady={readyOrder}
                  onDone={doneOrder}
                  onCancel={cancelWithConfirm}
                  t={t}
                />
              ))}
            </div>
            {ready.length === 0 && <p className="text-muted text-sm">{t('admin.noReady')}</p>}
          </section>
        </div>

        {done.length > 0 && (
          <section aria-label={t('admin.issuedAria')}>
            <h2 className="font-bold mb-2 text-muted">{t('admin.issuedRecently')}</h2>
            <ul className="text-sm text-muted flex flex-wrap gap-x-6 gap-y-1">
              {done.map((o) => (
                <li key={o.id}>
                  {o.code} ·{' '}
                  {t('admin.waitLabel', {
                    time: formatWait(Math.max(0, o.issuedAt - (o.arrivedAt ?? o.pickupAt)), lang)
                  })}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Демо- и сброс-кнопки имеют смысл только на локальном бэкенде: в общей базе
            «добавить демо-заказы» писало бы фейковые заказы в прод, а resetAll там
            намеренно недоступен. */}
        {canReset && (
          <footer className="flex flex-wrap gap-3 pt-4 border-t border-line text-sm">
            <button
              type="button"
              onClick={() => run(() => seedDemoOrders(restaurantId))}
              className="px-4 py-2 rounded-lg bg-card border border-line hover:bg-line"
            >
              {t('admin.addDemoOrders')}
            </button>
            <button
              type="button"
              onClick={clearStats}
              className="px-4 py-2 rounded-lg bg-card border border-line hover:bg-line"
            >
              {t('admin.clearStats')}
            </button>
            <button
              type="button"
              onClick={prepForDemo}
              className="px-4 py-2 rounded-lg bg-brand text-white font-semibold hover:opacity-90"
            >
              {t('admin.prepDemo')}
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t('admin.clearDataConfirm'))) run(() => resetAll());
              }}
              className="px-4 py-2 rounded-lg text-muted hover:text-ink"
            >
              {t('admin.clearData')}
            </button>
          </footer>
        )}
      </main>
    </div>
  );
}

export default function AdminBoard() {
  const [staff, setStaff] = useState(undefined); // undefined = проверяем сессию, null = не вошёл

  useEffect(() => onStaffAuthChange(setStaff), []);

  if (staff === undefined) return null;
  if (!staff) return <LoginGate />;

  // staff/{email} заполняется вручную в консоли Firebase: там бывает опечатка или
  // устаревший id. Раньше Board падал на allowedRestaurants[0].id и весь /staff
  // превращался в белый экран — теперь это обычный экран «нет доступа».
  const allowedRestaurants = allowedRestaurantsFor(staff.restaurantIds, restaurants);
  if (!allowedRestaurants.length) return <NoAccessGate email={staff.email} />;

  return <Board staff={staff} allowedRestaurants={allowedRestaurants} />;
}
