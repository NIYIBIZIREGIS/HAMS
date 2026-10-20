import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Building2, Globe2, ShieldCheck, Clock, Users, FileCheck2 } from 'lucide-react';
import { PublicFooter } from '../../components/layout/PublicFooter';

const U = (id: string, w = 1600) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const values = [
  { icon: Users, titleKey: 'public.value1Title', textKey: 'public.value1Text' },
  { icon: ShieldCheck, titleKey: 'public.value2Title', textKey: 'public.value2Text' },
  { icon: Clock, titleKey: 'public.value3Title', textKey: 'public.value3Text' },
  { icon: Globe2, titleKey: 'public.value4Title', textKey: 'public.value4Text' },
];

const milestones = [
  '1M+ appointments managed',
  '300+ facilities connected',
  '2,500+ doctors onboarded',
  '5,000+ patients served daily',
];

export function AboutPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-950">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={U('photo-1538108149393-fbbd81895907')} alt="Modern hospital building" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/70" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-28 md:py-36">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-semibold uppercase tracking-wider text-white backdrop-blur">
            <Building2 className="h-4 w-4" /> {t('public.aboutHeroTag')}
          </span>
          <h1 className="mt-6 max-w-3xl text-4xl font-extrabold leading-tight text-white md:text-5xl">{t('landing.aboutTitle')}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-200">{t('landing.aboutText1')}</p>
          <Link to="/register" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-base font-semibold text-white shadow-lg transition-transform hover:scale-105 hover:bg-primary-hover">
            {t('nav.getStarted')} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-extrabold leading-tight text-text-main dark:text-white">{t('public.ourMission')}</h2>
            <p className="mt-5 text-lg leading-relaxed text-text-main dark:text-slate-300">{t('landing.aboutText1')}</p>
            <p className="mt-4 text-lg leading-relaxed text-text-main dark:text-slate-300">{t('landing.aboutText2')}</p>
            <div className="mt-8 grid grid-cols-2 gap-4">
              {milestones.map((m) => (
                <div key={m} className="rounded-xl border border-slate-200 bg-card p-5 text-center shadow dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-sm font-semibold leading-snug text-text-main dark:text-white">{m}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-4">
            <img src={U('photo-1576091160399-112ba8d25d1d', 800)} alt="Doctor with stethoscope" className="h-72 w-full rounded-2xl object-cover shadow-xl md:h-80" loading="lazy" />
            <img src={U('photo-1587854692152-cbe660dbde88', 800)} alt="Doctor consulting a patient" className="h-64 w-full rounded-2xl object-cover shadow-xl md:h-72" loading="lazy" />
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-card py-20 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold text-text-main dark:text-white">{t('public.valuesTitle')}</h2>
            <p className="mt-3 text-lg text-text-muted dark:text-slate-400">{t('public.valuesSubtitle')}</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {values.map(({ icon: Icon, titleKey, textKey }) => (
              <div key={titleKey} className="rounded-xl border border-slate-200 bg-surface p-6 shadow transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-950">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white"><Icon className="h-6 w-6" /></span>
                <h3 className="mt-4 text-xl font-bold text-text-main dark:text-white">{t(titleKey)}</h3>
                <p className="mt-2 text-base leading-relaxed text-text-muted dark:text-slate-400">{t(textKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <img src={U('photo-1584982751601-97dcc096659c', 1000)} alt="Healthcare team" className="h-96 w-full rounded-2xl object-cover shadow-xl" loading="lazy" />
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold uppercase tracking-wider text-white"><FileCheck2 className="h-4 w-4" /> {t('public.whyChooseTitle')}</span>
            <ul className="mt-8 space-y-4">
              {[
                t('landing.trust1'),
                t('landing.trust2'),
                t('landing.trust3'),
                t('landing.trust4'),
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-card p-4 text-lg font-medium text-text-main shadow dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-status-confirmed-bg text-status-confirmed-text">✓</span>{item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}