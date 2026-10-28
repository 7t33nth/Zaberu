import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sheet from './Sheet.jsx';
import Steps from './Steps.jsx';
import { useCart, useCartSummary } from '../store/useCart.js';
import { placeOrder, subscribeSlots } from '../lib/api.js';
import { SlotFullError } from '../lib/errors.js';
import { addMyOrderId, getSavedName, saveName } from '../lib/myOrders.js';
import { HORIZON_MIN, buildSlots, ceilToSlot, formatClock, formatMinutes, formatMoney, hoursForDay, startOfDay } from '../lib/time.js';
import { LocationIcon, CloseIcon } from './Icons.jsx';
import { useLang, useT } from '../lib/i18n/store.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Полоска загрузки: зелёный (свободно) -> жёлтый (заполняется, >=70%) -> красный (полностью
// занято/не помещается) — читается с одного взгляда, без необходимости вчитываться в текст.
function loadTone(slot) {
  if (!slot.available || slot.load >= 1) return 'full';
  if (slot.load >= 0.7) return 'busy';
  return 'free';
}

function SlotChip({ slot, capacity, selected, onSelect, t }) {
  const tone = loadTone(slot);
  return (
    <button
      type="button"
      disabled={!slot.available}
      onClick={() => onSelect(slot.start)}
      aria-pressed={selected}
      className={`relative rounded-xl px-2 pt-2.5 pb-3.5 text-center border transition-colors ${
        selected
          ? 'bg-brand text-white border-brand shadow-sm'
          : slot.available
            ? 'bg-card text-ink border-line hover:border-ink/40'
            : 'bg-paper text-muted border-line/40 cursor-not-allowed'
      }`}
    >
      <div className={`font-bold text-[15px] ${slot.available ? '' : 'line-through text-muted'}`}>{formatClock(slot.start)}</div>
      <div
        className={`text-[10px] mt-0.5 font-semibold ${
          selected ? 'text-white/80' : tone === 'full' ? 'text-danger' : tone === 'busy' ? 'text-warn' : 'text-muted'
        }`}
      >
        {slot.available ? `${slot.used}/${capacity}` : t('checkout.slotTaken')}
      </div>
      <span
        className={`absolute left-2 right-2 bottom-1.5 h-1.5 rounded-full ${selected ? 'bg-white/20' : 'bg-line'}`}
        aria-hidden="true"
      >
        <span
          className={`block h-full rounded-full ${
            selected ? 'bg-white' : tone === 'full' ? 'bg-danger' : tone === 'busy' ? 'bg-warn' : 'bg-accent'
          }`}
          style={{ width: `${slot.used > 0 ? Math.max(6, Math.round(slot.load * 100)) : 0}%` }}
        />
      </span>
    </button>
  );
}

export default function CheckoutSheet({ open, onClose, restaurant }) {
  const summary = useCartSummary();
  const clear = useCart((s) => s.clear);
  const navigate = useNavigate();
  const t = useT();
  const lang = useLang();

  const [step, setStep] = useState(2);
  const [loads, setLoads] = useState({});
  const [now, setNow] = useState(Date.now());
  const [selected, setSelected] = useState(null);
  const [timeText, setTimeText] = useState('');
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [pay, setPay] = useState('online');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  // при каждом открытии начинаем с шага 2 (время)
  useEffect(() => {
    if (!open) return;
    setStep(2);
    setSelected(null);
    setTimeText('');
    setComment('');
    setNotice('');
    setBusy(false);
    setName(getSavedName());
  }, [open]);

  // живая занятость слотов + обновление «сейчас», чтобы прошедшие слоты пропадали
  useEffect(() => {
    if (!open) return undefined;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 15000);
    const unsub = subscribeSlots(restaurant.id, setLoads);
    return () => {
      clearInterval(t);
      unsub();
    };
  }, [open, restaurant.id]);

  const slots = useMemo(
    () =>
      buildSlots({
        hours: restaurant.hours,
        prepMinutes: summary.prepMinutes,
        loads,
        capacity: restaurant.slotCapacity,
        units: summary.units,
        now
      }),
    [restaurant, summary.prepMinutes, summary.units, loads, now]
  );
  const firstAvailable = slots.find((s) => s.available);

  // выбранный слот исчез (заняли или время прошло) — переносим на ближайший свободный
  useEffect(() => {
    if (!open || busy) return;
    const current = slots.find((s) => s.start === selected);
    if (current?.available) return;
    if (selected !== null) {
      setNotice(
        firstAvailable
          ? t('checkout.slotJustTaken', { time: formatClock(selected), next: formatClock(firstAvailable.start) })
          : t('checkout.noSlotsToday')
      );
      setStep(2);
    }
    setSelected(firstAvailable ? firstAvailable.start : null);
  }, [open, busy, slots, selected, firstAvailable]);

  // текстовое поле всегда отражает актуально выбранный слот (клик по чипу, автокоррекция и т.д.)
  useEffect(() => {
    if (selected != null) setTimeText(formatClock(selected));
  }, [selected]);

  const { closeMs } = hoursForDay(restaurant.hours, now);

  function pickSlot(start) {
    setSelected(start);
    setNotice('');
  }

  // Ввод по мере печати: только маска "ЧЧ:ММ", без проверки слотов — иначе полуготовое
  // значение вроде "1" или "10:" на каждое нажатие дёргало бы подбор ближайшего времени.
  function handleTimeInput(raw) {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    setTimeText(digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`);
  }

  // Проверяем введённое время при уходе с поля — подбираем ближайший слот с учётом часов
  // работы, готовки и текущей загрузки кухни (тот же buildSlots, что и у быстрых чипов ниже).
  function commitTypedTime() {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeText);
    if (!match) {
      if (selected != null) setTimeText(formatClock(selected));
      return;
    }
    const typedMs = ceilToSlot(startOfDay(now) + (Number(match[1]) * 60 + Number(match[2])) * 60000);

    const exact = slots.find((s) => s.start === typedMs);
    if (exact?.available) {
      setSelected(exact.start);
      setTimeText(formatClock(exact.start));
      setNotice('');
      return;
    }

    const nearest = slots
      .filter((s) => s.available)
      .sort((a, b) => Math.abs(a.start - typedMs) - Math.abs(b.start - typedMs))[0];

    if (nearest) {
      setSelected(nearest.start);
      setTimeText(formatClock(nearest.start));
      // Слоты строятся только на ближайшие HORIZON_MIN минут вперёд (см. buildSlots) — если
      // вписанное время позже последнего сгенерированного слота, называть его "ближайшим" было
      // бы враньём (например "23:45 -> ближайшее 14:30"). Честно объясняем горизонт предзаказа.
      const lastSlot = slots[slots.length - 1];
      const beyondHorizon = lastSlot && typedMs > lastSlot.start;
      const next = formatClock(nearest.start);
      setNotice(
        exact
          ? t('checkout.timeBusyCorrected', { time: timeText, next })
          : beyondHorizon
            ? t('checkout.timeTooFarCorrected', { hours: Math.round(HORIZON_MIN / 60), next })
            : t('checkout.timeOutOfRangeCorrected', { time: timeText, next })
      );
    } else {
      setNotice(t('checkout.noSlotsToday'));
    }
  }

  async function confirm() {
    if (busy || !selected || summary.units === 0) return;
    setBusy(true);
    setNotice('');
    try {
      await sleep(900); // имитация оплаты для демо — оба способа теперь предоплата
      const order = await placeOrder({
        restaurant,
        lines: summary.lines,
        pickupAt: selected,
        name,
        comment,
        pay
      });
      if (name.trim()) saveName(name.trim());
      addMyOrderId(order.id);
      clear();
      onClose();
      navigate(`/order/${order.id}`);
    } catch (err) {
      setBusy(false);
      if (err instanceof SlotFullError) {
        setNotice(t('checkout.timeJustTaken'));
        setStep(2);
      } else {
        console.error(err);
        setNotice(t('checkout.placeFailed'));
      }
    }
  }

  const waitMin = selected ? formatMinutes(selected - now, lang) : null;

  return (
    <Sheet open={open} onClose={busy ? () => {} : onClose} label={t('checkout.sheetLabel')}>
      <div className="flex items-center justify-between mb-4">
        <Steps current={step} />
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label={t('checkout.close')}
          className="w-8 h-8 rounded-full bg-paper border border-line text-muted hover:text-ink hover:border-ink/40 flex items-center justify-center transition-colors shadow-sm"
        >
          <CloseIcon className="w-4 h-4" />
        </button>
      </div>

      {notice && (
        <div role="alert" className="bg-warn-soft text-warn text-sm font-semibold rounded-xl px-4 py-3 mb-4 border border-warn/20">
          {notice}
        </div>
      )}

      {step === 2 && (
        <>
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <LocationIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{restaurant.name} · {restaurant.address}</span>
          </div>

          <h2 className="font-extrabold text-xl text-ink mt-2">{t('checkout.whenPickup')}</h2>
          <p className="text-sm text-muted mt-1">{t('checkout.whenPickupSubtitle')}</p>

          {slots.length === 0 || !firstAvailable ? (
            <div className="mt-6 rounded-xl bg-paper p-5 text-center text-sm text-muted">
              {t('checkout.noSlots')}
            </div>
          ) : (
            <>
              <div className="mt-5 flex items-end justify-between gap-3">
                <label className="flex-1 min-w-0">
                  <span className="text-xs text-muted">{t('checkout.pickupAtLabel')}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder={t('checkout.timePlaceholder')}
                    maxLength={5}
                    value={timeText}
                    onChange={(e) => handleTimeInput(e.target.value)}
                    onBlur={commitTypedTime}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    className="mt-1 block w-full bg-transparent text-5xl font-extrabold text-ink leading-none outline-none placeholder:text-muted/50 caret-[rgb(var(--color-ink))]"
                  />
                </label>
                {waitMin && <div className="text-sm text-muted pb-1 shrink-0">{t('checkout.waitIn', { time: waitMin })}</div>}
              </div>
              <p className="text-xs text-muted mt-2">
                {t('checkout.prepHint', { prep: formatMinutes(summary.prepMinutes * 60000, lang), close: formatClock(closeMs) })}
              </p>

              <div className="mt-5">
                <div className="text-xs font-semibold text-muted mb-2">{t('checkout.quickPick')}</div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
                  {slots.map((s) => (
                    <div key={s.start} className="w-[72px] shrink-0">
                      <SlotChip
                        slot={s}
                        capacity={restaurant.slotCapacity}
                        selected={s.start === selected}
                        onSelect={pickSlot}
                        t={t}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => selected && setStep(3)}
            disabled={!selected}
            className="w-full mt-4 bg-brand text-white font-bold py-4 rounded-xl disabled:opacity-40"
          >
            {t('checkout.next')}
          </button>
        </>
      )}

      {step === 3 && (
        <>
          <h2 className="font-extrabold text-xl text-ink">{t('checkout.reviewOrder')}</h2>

          <button
            type="button"
            onClick={() => setStep(2)}
            className="w-full mt-4 flex items-center justify-between bg-accent-soft rounded-xl px-4 py-3 text-left border border-accent/20 transition-colors hover:border-accent"
          >
            <span>
              <span className="block text-xs text-accent-dark font-medium">{restaurant.name}: {t('checkout.pickupAtLabel').toLowerCase()}</span>
              <span className="block text-2xl font-extrabold text-ink">{formatClock(selected)}</span>
              <span className="inline-flex items-center gap-1 text-xs text-accent-dark mt-0.5 font-medium">
                <LocationIcon className="w-3.5 h-3.5 text-accent-dark shrink-0" />
                <span>{restaurant.address}</span>
              </span>
            </span>
            <span className="text-sm font-semibold text-accent-dark shrink-0 underline-offset-2 hover:underline">{t('checkout.changeTime')}</span>
          </button>

          <ul className="mt-4 flex flex-col gap-2 max-h-40 overflow-y-auto">
            {summary.lines.map(({ dish, qty }) => (
              <li key={dish.id} className="flex justify-between text-sm">
                <span className="text-ink">
                  <b>{qty}×</b> {dish.name}
                </span>
                <span className="text-muted">{formatMoney(qty * dish.price)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between font-bold text-ink border-t border-line pt-3 mt-3">
            <span>{t('checkout.total')}</span>
            <span>{formatMoney(summary.total)}</span>
          </div>

          <label className="block mt-4">
            <span className="text-xs text-muted">{t('checkout.nameLabel')}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              autoComplete="given-name"
              placeholder={t('checkout.namePlaceholder')}
              className="mt-1 w-full bg-paper border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder:text-muted outline-none focus:ring-2 focus:ring-accent-dark"
            />
          </label>

          <label className="block mt-3">
            <span className="text-xs text-muted">{t('checkout.commentLabel')}</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={140}
              rows={2}
              placeholder={t('checkout.commentPlaceholder')}
              className="mt-1 w-full bg-paper border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder:text-muted outline-none focus:ring-2 focus:ring-accent-dark resize-none"
            />
          </label>

          <fieldset className="mt-4 grid grid-cols-2 gap-2">
            <legend className="sr-only">{t('checkout.paymentLegend')}</legend>
            {[
              ['online', t('checkout.payOnline'), t('checkout.payOnlineHint')],
              ['kaspi', t('checkout.payKaspi'), '']
            ].map(([value, title, hint]) => (
              <label
                key={value}
                className={`cursor-pointer rounded-xl border px-3 py-2.5 transition-colors ${
                  pay === value ? 'border-brand bg-brand-soft font-bold' : 'border-line bg-paper text-ink hover:border-ink/30'
                }`}
              >
                <input type="radio" name="pay" value={value} checked={pay === value} onChange={() => setPay(value)} className="sr-only" />
                <span className="block text-sm font-bold text-ink">{title}</span>
                {hint && <span className="block text-xs text-muted font-normal">{hint}</span>}
              </label>
            ))}
          </fieldset>

          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className="w-full mt-5 bg-brand text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {busy ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t('checkout.payBusy')}
              </>
            ) : (
              `${t('checkout.pay')} · ${formatMoney(summary.total)}`
            )}
          </button>
          <p className="text-center text-xs text-muted mt-3">{t('checkout.noSmsNotice')}</p>
        </>
      )}
    </Sheet>
  );
}
