import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CircleHelp, ChevronRight, LifeBuoy } from 'lucide-react';
import { PublicFooter } from '../../components/layout/PublicFooter';

/** FAQ topics, each mapped to the Help center article that covers it in more depth. */
const topics = [
  {
    key: 'account',
    items: [
      { q: 'help.qForgotPassword', a: 'help.aForgotPassword', link: '/help' },
      { q: 'help.qNationalId', a: 'help.aNationalId', link: '/help' },
      { q: 'help.qChangeEmail', a: 'help.aChangeEmail', link: '/help' },
      { q: 'help.qOtp', a: 'help.aOtp', link: '/help' },
    ],
  },
  {
    key: 'booking',
    items: [
      { q: 'help.qBookSlot', a: 'help.aBookSlot', link: '/how-it-works' },
      { q: 'help.qCancelSlot', a: 'help.aCancelSlot', link: '/help' },
      { q: 'help.qReschedule', a: 'help.aReschedule', link: '/help' },
      { q: 'help.qNoSlots', a: 'help.aNoSlots', link: '/help' },
    ],
  },
  {
    key: 'data',
    items: [
      { q: 'help.qDataStored', a: 'help.aDataStored', link: '/privacy-policy' },
      { q: 'help.qShareData', a: 'help.aShareData', link: '/privacy-policy' },
      { q: 'help.qRecords', a: 'help.aRecords', link: '/help' },
    ],
  },
  {
    key: 'offline',
    items: [
      { q: 'help.qNoInternet', a: 'help.aNoInternet', link: '/help' },
      { q: 'help.qSmsUssd', a: 'help.aSmsUssd', link: '/help' },
      { q: 'help.qLanguages', a: 'help.aLanguages', link: '/help' },
    ],
  },
];

export function FaqPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-950">
      <section className="bg-primary py-20 text-center text-white">
        <div className="mx-auto max-w-7xl px-4">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold uppercase tracking-wider backdrop-blur">
            <CircleHelp className="h-4 w-4" /> {t('help.faqBadge')}
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight md:text-5xl">{t('help.faqTitle')}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-100">{t('help.faqSubtitle')}</p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <div className="space-y-12">
          {topics.map(({ key, items }) => (
            <div key={key}>
              <h2 className="text-2xl font-extrabold text-text-main dark:text-white">{t(`help.group_${key}`)}</h2>
              <div className="mt-5 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-card dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                {items.map(({ q, a, link }) => (
                  <details key={q} className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-6 py-5 font-bold text-text-main dark:text-white">
                      {t(q)}
                      <ChevronRight className="ml-auto h-5 w-5 shrink-0 text-text-muted transition-transform group-open:rotate-90 dark:text-slate-400" aria-hidden="true" />
                    </summary>
                    <div className="px-6 pb-5">
                      <p className="leading-relaxed text-text-muted dark:text-slate-400">{t(a)}</p>
                      <Link to={link} className="mt-3 inline-flex items-center gap-1.5 font-semibold text-primary hover:text-primary-hover">
                        {t('help.readMore')} <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-2xl border border-slate-200 bg-card p-8 text-center shadow dark:border-slate-800 dark:bg-slate-900">
          <LifeBuoy className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-2xl font-extrabold text-text-main dark:text-white">{t('help.stillNeedHelp')}</h2>
          <p className="mx-auto mt-3 max-w-xl text-text-muted dark:text-slate-400">{t('help.stillNeedHelpText')}</p>
          <Link to="/help" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-lg font-semibold text-white shadow-lg transition-transform hover:scale-105 hover:bg-primary-hover">
            {t('help.goToHelpCenter')} <ChevronRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}