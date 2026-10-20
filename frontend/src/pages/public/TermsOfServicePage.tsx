import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Scale, CheckCircle2, XCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { PublicFooter } from '../../components/layout/PublicFooter';

export function TermsOfServicePage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-950">
      <section className="bg-primary py-20 text-center text-white">
        <div className="mx-auto max-w-7xl px-4">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold uppercase tracking-wider backdrop-blur">
            <Scale className="h-4 w-4" /> {t('legal.badge')}
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight md:text-5xl">{t('legal.termsTitle')}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-100">{t('legal.termsIntro')}</p>
          <p className="mt-4 text-sm text-slate-300">{t('legal.lastUpdated')}</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid gap-8 md:grid-cols-3">
          {[
            { icon: CheckCircle2, titleKey: 'legal.doTitle', textKey: 'legal.doText' },
            { icon: XCircle, titleKey: 'legal.dontTitle', textKey: 'legal.dontText' },
            { icon: AlertTriangle, titleKey: 'legal.riskTitle', textKey: 'legal.riskText' },
          ].map(({ icon: Icon, titleKey, textKey }) => (
            <div key={titleKey} className="rounded-2xl border border-slate-200 bg-card p-6 shadow dark:border-slate-800 dark:bg-slate-900">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white">
                <Icon className="h-6 w-6" />
              </span>
              <h2 className="mt-4 text-lg font-bold text-text-main dark:text-white">{t(titleKey)}</h2>
              <p className="mt-2 text-base leading-relaxed text-text-muted dark:text-slate-400">{t(textKey)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-200 bg-card py-16 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-3xl px-4">
          <div className="flex items-center gap-3">
            <Scale className="h-7 w-7 text-primary" />
            <h2 className="text-3xl font-extrabold text-text-main dark:text-white">{t('legal.sectionsTitle')}</h2>
          </div>

          <div className="mt-8 space-y-8">
            {['acceptance', 'appointments', 'accounts', 'obligations', 'fees', 'liability', 'changes'].map((s) => (
              <article key={s}>
                <h3 className="text-xl font-bold text-text-main dark:text-white">{t(`legal.t_${s}`)}</h3>
                <p className="mt-2 leading-relaxed text-text-muted dark:text-slate-400">{t(`legal.tp_${s}`)}</p>
              </article>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border border-slate-200 bg-surface p-8 text-center dark:border-slate-800 dark:bg-slate-950">
            <h2 className="text-2xl font-extrabold text-text-main dark:text-white">{t('legal.questionsTitle')}</h2>
            <p className="mt-3 text-text-muted dark:text-slate-400">{t('legal.questionsText')}</p>
            <Link to="/help" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-lg font-semibold text-white shadow-lg transition-transform hover:scale-105 hover:bg-primary-hover">
              {t('help.title')} <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}