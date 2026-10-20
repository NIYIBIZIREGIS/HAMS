import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  HeartPulse, ArrowRight, CalendarCheck, Stethoscope, Users, Building2,
  Pill, Microscope, ShieldCheck, Clock, Wifi, Smartphone,
  Globe, ClipboardList, ChevronRight, UserPlus, Scan, Workflow,
} from 'lucide-react';
import { PublicFooter } from '../components/layout/PublicFooter';

const U = (id: string, w = 1600) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const MODULES = [
  { icon: CalendarCheck, titleKey: 'landing.module1Title', textKey: 'landing.module1Text' },
  { icon: ClipboardList, titleKey: 'landing.module2Title', textKey: 'landing.module2Text' },
  { icon: Pill, titleKey: 'landing.module3Title', textKey: 'landing.module3Text' },
  { icon: Scan, titleKey: 'landing.module4Title', textKey: 'landing.module4Text' },
  { icon: Microscope, titleKey: 'landing.module5Title', textKey: 'landing.module5Text' },
  { icon: ShieldCheck, titleKey: 'landing.module6Title', textKey: 'landing.module6Text' },
];

const MODULES_IMAGES = [
  U('photo-1516549655169-df83a0774514', 800),
  U('photo-1579684385127-1ef15d508118', 800),
  U('photo-1587854692152-cbe660dbde88', 800),
  U('photo-1576091160399-112ba8d25d1d', 800),
  U('photo-1538108149393-fbbd81895907', 800),
  U('photo-1584982751601-97dcc096659c', 800),
];

const STEPS_IMAGES = [
  U('photo-1551190822-a9333d879b1f', 700),
  U('photo-1538108149393-fbbd81895907', 700),
  U('photo-1576091160399-112ba8d25d1d', 700),
  U('photo-1579684385127-1ef15d508118', 700),
];

const ROLES_IMAGES = [
  { img: U('photo-1551190822-a9333d879b1f', 900), alt: 'Patient at a clinic reception' },
  { img: U('photo-1579684385127-1ef15d508118', 900), alt: 'Doctor with a patient using a tablet' },
  { img: U('photo-1516549655169-df83a0774514', 900), alt: 'Hospital admin staff at work' },
];

export function Landing() {
  const { t } = useTranslation();
  const [slide, setSlide] = useState(0);

  const heroSlides = [
    { img: U('photo-1576091160399-112ba8d25d1d'), alt: 'Friendly doctor with a stethoscope', tag: t('public.heroSlide1Tag'), title: t('public.heroSlide1Title') },
    { img: U('photo-1587854692152-cbe660dbde88'), alt: 'Doctor consulting a patient', tag: t('public.heroSlide2Tag'), title: t('public.heroSlide2Title') },
    { img: U('photo-1579684385127-1ef15d508118'), alt: 'Care team using a tablet', tag: t('public.heroSlide3Tag'), title: t('public.heroSlide3Title') },
    { img: U('photo-1584982751601-97dcc096659c'), alt: 'Healthcare workers in masks', tag: t('public.heroSlide4Tag'), title: t('public.heroSlide4Title') },
  ];

  const stats = [
    { value: '300+', labelKey: 'landing.statFacilities', icon: Building2 },
    { value: '2,500+', labelKey: 'landing.statDoctorsCount', icon: Stethoscope },
    { value: '1M+', labelKey: 'landing.statPatientsCount', icon: Users },
    { value: '99.9%', labelKey: 'landing.statUptime', icon: Wifi },
  ];

  const steps = [
    { icon: UserPlus, titleKey: 'landing.step1Title', textKey: 'landing.step1Text' },
    { icon: Building2, titleKey: 'landing.step2Title', textKey: 'landing.step2Text' },
    { icon: CalendarCheck, titleKey: 'landing.step3Title', textKey: 'landing.step3Text' },
    { icon: Stethoscope, titleKey: 'landing.step4Title', textKey: 'landing.step4Text' },
  ];

  const roles = [
    { icon: UserPlus, titleKey: 'landing.rolePatientTitle', textKey: 'landing.rolePatientText', itemKeys: ['landing.patientItem1', 'landing.patientItem2', 'landing.patientItem3'] },
    { icon: Stethoscope, titleKey: 'landing.roleDoctorTitle', textKey: 'landing.roleDoctorText', itemKeys: ['landing.doctorItem1', 'landing.doctorItem2', 'landing.doctorItem3'] },
    { icon: Building2, titleKey: 'landing.roleStaffTitle', textKey: 'landing.roleStaffText', itemKeys: ['landing.staffItem1', 'landing.staffItem2', 'landing.staffItem3'] },
  ];

  const trust = [
    { icon: Smartphone, textKey: 'landing.aboutStat1' },
    { icon: Globe, textKey: 'landing.stat2Label' },
    { icon: Clock, textKey: 'landing.trust2' },
    { icon: ShieldCheck, textKey: 'landing.trust1' },
  ];

  const channels = [
    { icon: Workflow, labelKey: 'public.webPlatform' },
    { icon: Smartphone, labelKey: 'public.mobileFriendly' },
    { icon: Globe, labelKey: 'public.ussdSms' },
    { icon: Building2, labelKey: 'public.frontDesk' },
  ];

  useEffect(() => {
    const id = setInterval(() => setSlide((s) => (s + 1) % heroSlides.length), 6000);
    return () => clearInterval(id);
  }, [heroSlides.length]);

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-950">
      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-950 dark:bg-slate-950">
        <div className="absolute inset-0">
          {heroSlides.map((s, i) => (
            <img key={s.img} src={s.img} alt={s.alt} loading={i === 0 ? 'eager' : 'lazy'}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${i === slide ? 'opacity-100' : 'opacity-0'}`} />
          ))}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/50 to-slate-950/20" />
        </div>

        <div className="relative mx-auto flex max-w-7xl flex-col justify-center px-4 py-28 md:py-40 lg:min-h-[620px]">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-semibold uppercase tracking-wider text-white backdrop-blur">
              <HeartPulse className="h-4 w-4" /> {t('landing.heroBadge')}
            </span>
            <h1 className="mt-6 text-5xl font-extrabold leading-[1.1] text-white md:text-6xl">
              {heroSlides[slide].title}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-200 md:text-xl">{heroSlides[slide].tag} — {t('landing.heroIntro')}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/register" className="inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-lg font-semibold text-white shadow-lg ring-1 ring-white/30 transition-transform hover:scale-105 hover:bg-primary-hover">{t('nav.getStarted')}<ArrowRight className="h-5 w-5" /></Link>
              <Link to="/how-it-works" className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-7 py-3.5 text-lg font-semibold text-white backdrop-blur transition-colors hover:bg-white/20">{t('landing.learnMore')}</Link>
            </div>
          </div>

          <div className="mt-12 flex items-center gap-2">
            {heroSlides.map((_, i) => (
              <button key={i} type="button" onClick={() => setSlide(i)} aria-label={`Slide ${i + 1}`}
                className={`h-2.5 rounded-full transition-all duration-500 ${i === slide ? 'w-10 bg-white' : 'w-2.5 bg-white/40 hover:bg-white/70'}`} />
            ))}
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-b border-slate-200 bg-card dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-10 lg:grid-cols-4">
          {stats.map(({ value, labelKey, icon: Icon }) => (
            <div key={labelKey} className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-white"><Icon className="h-6 w-6" /></span>
              <div>
                <p className="text-2xl font-extrabold text-text-main dark:text-white">{value}</p>
                <p className="text-sm text-text-muted dark:text-slate-400">{t(labelKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* About preview */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="relative">
            <img src={U('photo-1538108149393-fbbd81895907', 900)} alt="Modern hospital building" className="h-96 w-full rounded-2xl object-cover shadow-xl" loading="lazy" />
            <div className="absolute -bottom-6 -right-4 rounded-xl bg-primary p-5 text-white shadow-xl">
              <p className="text-3xl font-extrabold">24/7</p>
              <p className="text-sm text-slate-100">{t('landing.aboutStat3')}</p>
            </div>
          </div>
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold uppercase tracking-wider text-white">{t('public.aboutHeroTag')}</span>
            <h2 className="mt-5 text-3xl font-extrabold leading-tight text-text-main dark:text-white md:text-4xl">{t('landing.aboutTitle')}</h2>
            <p className="mt-5 text-lg leading-relaxed text-text-main dark:text-slate-300">{t('landing.aboutText1')}</p>
            <p className="mt-3 text-lg leading-relaxed text-text-main dark:text-slate-300">{t('landing.aboutText2')}</p>
            <div className="mt-6 grid grid-cols-2 gap-4">
              {[t('landing.aboutStat1'), t('landing.aboutStat2'), t('landing.aboutStat4'), t('landing.stat2Value')].map((s) => (
                <div key={s} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-card px-4 py-3 text-sm font-semibold text-text-main shadow dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">✓ {s}</div>
              ))}
            </div>
            <Link to="/about" className="mt-8 inline-flex items-center gap-2 text-lg font-semibold text-primary hover:text-primary-hover">{t('landing.learnMore')}<ChevronRight className="h-5 w-5" /></Link>
          </div>
        </div>
      </section>

      {/* How it works preview */}
      <section className="border-y border-slate-200 bg-card py-20 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div>
              <h2 className="text-3xl font-extrabold text-text-main dark:text-white md:text-4xl">{t('landing.howTitle')}</h2>
              <p className="mt-3 text-lg text-text-muted dark:text-slate-400">{t('landing.howSubtitle')}</p>
            </div>
            <Link to="/how-it-works" className="inline-flex items-center gap-2 text-lg font-semibold text-primary hover:text-primary-hover">{t('landing.learnMore')}<ArrowRight className="h-5 w-5" /></Link>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ icon: Icon, titleKey, textKey }, i) => (
              <div key={titleKey} className="group overflow-hidden rounded-xl border border-slate-200 bg-surface shadow transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-950">
                <div className="relative h-44 overflow-hidden">
                  <img src={STEPS_IMAGES[i]} alt={t(titleKey)} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                  <span className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-sm font-extrabold text-white">{i + 1}</span>
                </div>
                <div className="p-5">
                  <Icon className="h-6 w-6 text-primary" />
                  <h3 className="mt-3 text-lg font-bold text-text-main dark:text-white">{t(titleKey)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-muted dark:text-slate-400">{t(textKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold text-text-main dark:text-white md:text-4xl">{t('landing.modulesTitle')}</h2>
          <p className="mt-3 text-lg text-text-muted dark:text-slate-400">{t('landing.modulesSubtitle')}</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {MODULES.map(({ icon: Icon, titleKey, textKey }, i) => (
            <div key={titleKey} className="group overflow-hidden rounded-xl border border-slate-200 bg-card shadow transition-all hover:-translate-y-1 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <div className="relative h-40 overflow-hidden">
                <img src={MODULES_IMAGES[i]} alt={t(titleKey)} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <span className="absolute bottom-3 left-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white shadow-lg"><Icon className="h-5 w-5" /></span>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-text-main dark:text-white">{t(titleKey)}</h3>
                <p className="mt-2 text-base leading-relaxed text-text-muted dark:text-slate-400">{t(textKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section className="border-y border-slate-200 bg-card py-20 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold text-text-main dark:text-white md:text-4xl">{t('landing.rolesTitle')}</h2>
            <p className="mt-3 text-lg text-text-muted dark:text-slate-400">{t('landing.rolesSubtitle')}</p>
          </div>
          <div className="mt-12 space-y-8">
            {roles.map(({ icon: Icon, titleKey, textKey, itemKeys }, i) => (
              <div key={titleKey} className={`grid items-center gap-8 overflow-hidden rounded-xl border border-slate-200 bg-surface shadow dark:border-slate-800 dark:bg-slate-950 lg:grid-cols-2 ${i % 2 === 1 ? 'lg:[&>*:first-child]:order-2' : ''}`}>
                <img src={ROLES_IMAGES[i].img} alt={ROLES_IMAGES[i].alt} className="h-72 w-full object-cover lg:h-80" loading="lazy" />
                <div className="p-8 md:p-10">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white"><Icon className="h-6 w-6" /></span>
                  <h3 className="mt-4 text-2xl font-bold text-text-main dark:text-white">{t(titleKey)}</h3>
                  <p className="mt-2 text-lg text-text-muted dark:text-slate-400">{t(textKey)}</p>
                  <ul className="mt-5 space-y-2.5">
                    {itemKeys.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-base font-medium text-text-main dark:text-slate-200">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-status-confirmed-bg text-status-confirmed-text"><span className="text-xs">✓</span></span>
                        {t(item)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {trust.map(({ icon: Icon, textKey }) => (
            <div key={textKey} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-card p-5 shadow dark:border-slate-800 dark:bg-slate-900">
              <Icon className="h-6 w-6 shrink-0 text-primary" />
              <p className="text-base font-semibold text-text-main dark:text-white">{t(textKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials preview */}
      <section className="border-y border-slate-200 bg-card py-20 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex flex-col items-center justify-between gap-4 text-center md:flex-row md:text-left">
            <div>
              <h2 className="text-3xl font-extrabold text-text-main dark:text-white md:text-4xl">{t('public.lovedTitle')}</h2>
              <p className="mt-3 text-lg text-text-muted dark:text-slate-400">{t('public.lovedSubtitle')}</p>
            </div>
            <Link to="/comments" className="inline-flex items-center gap-2 text-lg font-semibold text-primary hover:text-primary-hover">{t('public.allComments')}<ArrowRight className="h-5 w-5" /></Link>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              { name: 'Dr. Mukamana', role: 'Facility Director', text: t('landing.testimonial'), img: U('photo-1559839734-2b71ea197ec2', 200) },
              { name: 'Aline Uwase', role: 'Nurse', text: 'The queue system is a game changer. Patients follow their numbers and we always know who is next.', img: U('photo-1494790108377-be9c29b29330', 200) },
              { name: 'Eric Mugisha', role: 'Doctor', text: 'Managing my calendar used to take an hour a day. Now schedules update themselves.', img: U('photo-1544005313-94ddf0286df2', 200) },
            ].map(({ name, role, text, img }) => (
              <figure key={name} className="rounded-xl border border-slate-200 bg-surface p-6 shadow dark:border-slate-800 dark:bg-slate-950">
                <p className="text-lg leading-relaxed text-text-main dark:text-slate-200">"{text}"</p>
                <figcaption className="mt-5 flex items-center gap-3">
                  <img src={img} alt={name} className="h-12 w-12 rounded-full object-cover" loading="lazy" />
                  <div>
                    <p className="font-bold text-text-main dark:text-white">{name}</p>
                    <p className="text-sm text-text-muted dark:text-slate-400">{role}</p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Channels - text strip */}
      <section className="border-t border-slate-200 bg-card dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-6 px-4 py-8 text-center">
          {channels.map(({ icon: Icon, labelKey }) => (
            <span key={labelKey} className="flex items-center gap-2 text-base font-semibold text-text-main dark:text-slate-300"><Icon className="h-5 w-5 text-primary" />{t(labelKey)}</span>
          ))}
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}