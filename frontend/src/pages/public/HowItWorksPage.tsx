import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserPlus, MapPin, CalendarDays, Stethoscope, BellRing, CheckCircle2, ArrowRight } from 'lucide-react';
import { PublicFooter } from '../../components/layout/PublicFooter';

const U = (id: string, w = 1600) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

export function HowItWorksPage() {
  const { t } = useTranslation();

  const steps = [
    {
      icon: UserPlus,
      num: '01',
      title: t('landing.step1Title'),
      text: t('landing.step1Text'),
      img: U('photo-1551190822-a9333d879b1f', 900),
      alt: 'Patient registering at a hospital reception',
    },
    {
      icon: MapPin,
      num: '02',
      title: t('landing.step2Title'),
      text: t('landing.step2Text'),
      img: U('photo-1538108149393-fbbd81895907', 900),
      alt: 'Choosing a facility and doctor',
    },
    {
      icon: CalendarDays,
      num: '03',
      title: t('landing.step3Title'),
      text: t('landing.step3Text'),
      img: U('photo-1576091160399-112ba8d25d1d', 900),
      alt: 'Selecting a date and time slot',
    },
    {
      icon: Stethoscope,
      num: '04',
      title: t('landing.step4Title'),
      text: t('landing.step4Text'),
      img: U('photo-1579684385127-1ef15d508118', 900),
      alt: 'Patient being seen by the doctor',
    },
  ];

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-950">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={U('photo-1579684385127-1ef15d508118')} alt="Doctor using a tablet" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/70" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-28 text-center md:py-36">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-semibold uppercase tracking-wider text-white backdrop-blur">{t('public.stepByStep')}</span>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight text-white md:text-5xl">{t('landing.howTitle')}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-200">{t('landing.howSubtitle')}</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="space-y-10">
          {steps.map(({ icon: Icon, num, title, text, img, alt }) => (
            <div key={num} className="grid items-center gap-8 overflow-hidden rounded-xl border border-slate-200 bg-card shadow dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-2">
              <div className={`relative h-64 lg:h-80 ${num === '02' || num === '04' ? 'lg:order-2' : ''}`}>
                <img src={img} alt={alt} className="h-full w-full object-cover" loading="lazy" />
                <span className="absolute left-4 top-4 rounded-xl bg-primary px-3 py-1 text-lg font-extrabold text-white">{num}</span>
              </div>
              <div className="p-8 md:p-10">
                <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-white"><Icon className="h-7 w-7" /></span>
                <h2 className="mt-5 text-2xl font-extrabold text-text-main dark:text-white">{title}</h2>
                <p className="mt-3 text-lg leading-relaxed text-text-muted dark:text-slate-400">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-card py-16 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { icon: BellRing, title: t('public.instantConfirmTitle'), text: t('public.instantConfirmText') },
              { icon: CheckCircle2, title: t('public.checkInTitle'), text: t('public.checkInText') },
              { icon: Stethoscope, title: t('public.planTitle'), text: t('public.planText') },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-xl border border-slate-200 bg-surface p-6 shadow dark:border-slate-800 dark:bg-slate-950">
                <Icon className="h-8 w-8 text-primary" />
                <h3 className="mt-4 text-lg font-bold text-text-main dark:text-white">{title}</h3>
                <p className="mt-2 text-base leading-relaxed text-text-muted dark:text-slate-400">{text}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link to="/register" className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-lg font-semibold text-white shadow-lg transition-transform hover:scale-105 hover:bg-primary-hover">
              {t('nav.getStarted')} <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}