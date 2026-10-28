import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useT } from '../lib/i18n/store.js';
import { MailIcon, ChevronDownIcon } from './Icons.jsx';

const COOPERATION_EMAIL = 'dilanabkanov@gmail.com';
const FAQ_IDS = [1, 2, 3, 4, 5, 6];

function FaqItem({ q, a, open, onToggle }) {
  return (
    <div className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 py-4 text-left"
      >
        <span className="font-bold text-ink">{q}</span>
        <span
          className={`shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <ChevronDownIcon className="w-5 h-5" />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="text-sm text-muted leading-relaxed pb-4 pr-8">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Footer() {
  const t = useT();
  const [openId, setOpenId] = useState(1);

  return (
    <footer className="mt-14 lg:mt-20 lg:max-w-[1340px] lg:mx-auto lg:px-10">
      <div className="px-4 lg:px-0 grid gap-4 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        <section
          aria-labelledby="faq-heading"
          className="bg-card border border-line rounded-3xl p-5 lg:p-7"
        >
          <h2 id="faq-heading" className="font-extrabold text-lg lg:text-xl text-ink">
            {t('footer.faqHeading')}
          </h2>
          <div className="mt-2">
            {FAQ_IDS.map((id) => (
              <FaqItem
                key={id}
                q={t(`footer.faq.q${id}`)}
                a={t(`footer.faq.a${id}`)}
                open={openId === id}
                onToggle={() => setOpenId((cur) => (cur === id ? null : id))}
              />
            ))}
          </div>
        </section>

        <section className="bg-brand text-white rounded-3xl p-6 lg:p-7 flex flex-col lg:h-full lg:justify-center">
          <h2 className="font-extrabold text-lg lg:text-xl">{t('footer.cooperationHeading')}</h2>
          <p className="text-sm text-white/80 mt-2 leading-relaxed">
            {t('footer.cooperationText')}
          </p>
          <a
            href={`mailto:${COOPERATION_EMAIL}`}
            className="mt-5 inline-flex items-center justify-center gap-2 bg-white text-brand font-bold px-5 py-3 rounded-xl hover:opacity-90 transition-opacity w-fit"
          >
            <MailIcon className="w-4 h-4" />
            {t('footer.cooperationButton')}
          </a>
        </section>
      </div>

      <p className="px-4 lg:px-0 text-center text-xs text-muted mt-8 pb-8">{t('footer.rights')}</p>
    </footer>
  );
}
