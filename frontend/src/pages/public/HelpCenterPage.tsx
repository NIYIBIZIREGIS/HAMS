import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LifeBuoy, CircleHelp, ShieldCheck, ChevronRight,
  Mail, Phone, MessageCircle, BookOpen, Clock, Lock,
} from 'lucide-react';
import { PublicFooter } from '../../components/layout/PublicFooter';

/**
 * Help center. Grouped rather than one long list, because "I forgot my password" and "how do
 * you store my national ID" are very different intents and should not sit next to each other.
 */
const groups = [
  {
    key: 'booking',
    icon: BookOpen,
    items: [
      { q: 'help.qBookSlot', a: 'help.aBookSlot' },
      { q: 'help.qCancelSlot', a: 'help.aCancelSlot' },
      { q: 'help.qReschedule', a: 'help.aReschedule' },
      { q: 'help.qNoSlots', a: 'help.aNoSlots' },
    ],
  },
  {
    key: 'account',
    icon: Lock,
    items: [
      { q: 'help.qForgotPassword', a: 'help.aForgotPassword' },
      { q: 'help.qNationalId', a: 'help.aNationalId' },
      { q: 'help.qChangeEmail', a: 'help.aChangeEmail' },
      { q: 'help.qOtp', a: 'help.aOtp' },
    ],
  },
  {
    key: 'data',
    icon: ShieldCheck,
    items: [
      { q: 'help.qDataStored', a: 'help.aDataStored' },
      { q: 'help.qShareData', a: 'help.aShareData' },
      { q: 'help.qRecords', a: 'help.aRecords' },
    ],
  },
  {
    key: 'offline',
    icon: Clock,
    items: [
      { q: 'help.qNoInternet', a: 'help.aNoInternet' },
      { q: 'help.qSmsUssd', a: 'help.aSmsUssd' },
      { q: 'help.qLanguages', a: 'help.aLanguages' },
    ],
  },
];

export function HelpCenterPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-950">
      <section className="bg-primary py-20 text-center text-white">
        <div className="mx-auto max-w-7xl px-4">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold uppercase tracking-wider backdrop-blur">
            <LifeBuoy className="h-4 w-4" /> {t('help.helpBadge')}
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight md:text-5xl">{t('help.title')}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-100">{t('help.subtitle')}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/faq" className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-lg font-semibold text-primary shadow-lg transition-transform hover:scale-105">
              <CircleHelp className="h-5 w-5" /> {t('help.viewFaqs')}
            </Link>
            <a href="mailto:support@has.local" className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-7 py-3.5 text-lg font-semibold backdrop-blur transition-colors hover:bg-white/20">
              {t('help.contactSupport')}
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid gap-8 md:grid-cols-3">
          {[
            { icon: Mail, title: t('help.byEmail'), text: t('help.byEmailText'), href: 'mailto:support@has.local', action: 'support@has.local' },
            { icon: Phone, title: t('help.byPhone'), text: t('help.byPhoneText'), href: 'tel:+250788000000', action: '+250 788 000 000' },
            { icon: MessageCircle, title: t('help.hours'), text: t('help.hoursText'), href: null, action: null },
          ].map(({ icon: Icon, title, text, href, action }) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-card p-6 shadow dark:border-slate-800 dark:bg-slate-900">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white">
                <Icon className="h-6 w-6" />
              </span>
              <h2 className="mt-4 text-lg font-bold text-text-main dark:text-white">{title}</h2>
              <p className="mt-2 text-base leading-relaxed text-text-muted dark:text-slate-400">{text}</p>
              {href && action && (
                <a href={href} className="mt-4 inline-flex items-center gap-1.5 font-semibold text-primary hover:text-primary-hover">
                  {action} <ChevronRight className="h-4 w-4" />
                </a>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-200 bg-card py-16 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-3xl font-extrabold text-text-main dark:text-white">{t('help.topicsTitle')}</h2>
          <p className="mt-3 text-lg text-text-muted dark:text-slate-400">{t('help.topicsSubtitle')}</p>

          <div className="mt-10 space-y-10">
            {groups.map(({ key, icon: Icon, items }) => (
              <div key={key}>
                <h3 className="flex items-center gap-2.5 text-xl font-bold text-text-main dark:text-white">
                  <Icon className="h-6 w-6 text-primary" /> {t(`help.group_${key}`)}
                </h3>
                <dl className="mt-4 grid gap-4 md:grid-cols-2">
                  {items.map(({ q, a }) => (
                    <div key={q} className="rounded-xl border border-slate-200 bg-surface p-5 dark:border-slate-800 dark:bg-slate-950">
                      <dt className="font-bold text-text-main dark:text-white">{t(q)}</dt>
                      <dd className="mt-2 text-base leading-relaxed text-text-muted dark:text-slate-400">{t(a)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link to="/faq" className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-lg font-semibold text-white shadow-lg transition-transform hover:scale-105 hover:bg-primary-hover">
              {t('help.viewFaqs')} <ChevronRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}