import { useTranslation } from 'react-i18next';
import { Star, Quote, MessageSquare, HeartHandshake, Clock4, ShieldCheck } from 'lucide-react';
import { PublicFooter } from '../../components/layout/PublicFooter';

const U = (id: string, w = 800) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

interface Testimonial {
  name: string;
  role: string;
  text: string;
  avatar: string;
  photo: string;
  photoAlt: string;
}

export function CommentsPage() {
  const { t } = useTranslation();

  const testimonials: Testimonial[] = [
    {
      name: 'Jean Baptiste',
      role: t('demo.rolePatient'),
      text: t('landing.testimonial'),
      avatar: U('photo-1633332755192-727a05c4013d', 200),
      photo: U('photo-1551190822-a9333d879b1f', 700),
      photoAlt: 'Patient arriving at a clinic reception desk',
    },
    {
      name: 'Aline Uwase',
      role: 'Nurse',
      text: 'The queue system is a game changer. Patients follow their numbers on their phones and we always know who is next.',
      avatar: U('photo-1494790108377-be9c29b29330', 200),
      photo: U('photo-1584982751601-97dcc096659c', 700),
      photoAlt: 'Nurses working together on a hospital ward',
    },
    {
      name: 'Eric Mugisha',
      role: t('demo.roleDoctor'),
      text: 'Managing my clinic calendar used to take an hour a day. Now schedules update themselves and patients book themselves.',
      avatar: U('photo-1544005313-94ddf0286df2', 200),
      photo: U('photo-1576091160399-112ba8d25d1d', 700),
      photoAlt: 'Doctor with a stethoscope ready to help a patient',
    },
    {
      name: 'Claudine Ndahiro',
      role: 'Receptionist',
      text: 'We register walk-ins, arrange visits by SMS, and the dashboard shows everything happening in real time.',
      avatar: U('photo-1534528741775-53994a69daeb', 200),
      photo: U('photo-1519494026892-80bbd2d6fd0d', 700),
      photoAlt: 'Reception desk where patients check in for appointments',
    },
    {
      name: 'Patrick Habimana',
      role: 'Health center manager',
      text: 'Even in areas without reliable internet our team books and tracks appointments through USSD. Excellent support.',
      avatar: U('photo-1560250097-0b93528c311a', 200),
      photo: U('photo-1516549655169-df83a0774514', 700),
      photoAlt: 'Health center administrators coordinating the daily schedule',
    },
    {
      name: 'Sandrine Ingabire',
      role: t('demo.rolePatient'),
      text: 'I booked my mother\u2019s check-up in under two minutes and got a reminder the day before. Faster than any previous system.',
      avatar: U('photo-1438761681033-6461ffad8d80', 200),
      photo: U('photo-1579684385127-1ef15d508118', 700),
      photoAlt: 'Care team using a tablet during a consultation',
    },
  ];

  const gallery = [
    { img: U('photo-1538108149393-fbbd81895907', 900), alt: 'Modern hospital building exterior' },
    { img: U('photo-1587854692152-cbe660dbde88', 900), alt: 'Doctor consulting a patient in a bright office' },
    { img: U('photo-1559839734-2b71ea197ec2', 900), alt: 'Facility director smiling in a hospital corridor' },
  ];

  const stats = [
    { icon: MessageSquare, value: '4.9/5', labelKey: 'public.avgRating' },
    { icon: HeartHandshake, value: '2,400+', labelKey: 'public.writtenReviews' },
    { icon: Clock4, value: '97%', labelKey: 'public.onTimeAppointments' },
    { icon: ShieldCheck, value: '100%', labelKey: 'public.dataSecured' },
  ];

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-950">
      <section className="relative overflow-hidden border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-4 py-20 text-center md:py-28">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold uppercase tracking-wider text-white">
            <MessageSquare className="h-4 w-4" /> {t('nav.comments')}
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight text-text-main dark:text-white md:text-5xl">{t('public.commentsTitle')}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-text-muted dark:text-slate-400">{t('public.commentsSubtitle')}</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map(({ icon: Icon, value, labelKey }) => (
              <div key={labelKey} className="flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-card p-5 shadow dark:border-slate-800 dark:bg-slate-900">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white"><Icon className="h-5 w-5" /></span>
                <div className="text-left">
                  <p className="text-2xl font-extrabold text-text-main dark:text-white">{value}</p>
                  <p className="text-sm text-text-muted dark:text-slate-400">{t(labelKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map(({ name, role, text, avatar, photo, photoAlt }) => (
            <figure key={name} className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-card shadow transition-shadow hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
              <div className="relative h-44 shrink-0 overflow-hidden">
                <img
                  src={photo}
                  alt={photoAlt}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent" />
                <Quote className="absolute right-4 top-4 h-7 w-7 text-white/85" aria-hidden="true" />
              </div>
              <div className="flex flex-1 flex-col p-6">
                <div className="relative pl-16">
                  <img
                    src={avatar}
                    alt={name}
                    className="absolute -top-12 left-0 h-14 w-14 rounded-full object-cover ring-4 ring-white dark:ring-slate-900"
                    loading="lazy"
                  />
                  <p className="font-bold text-text-main dark:text-white">{name}</p>
                  <p className="text-sm text-text-muted dark:text-slate-400">{role}</p>
                </div>
                <div className="mt-4 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-pending-text text-pending-text" />)}
                </div>
                <blockquote className="mt-3 flex-1 text-base leading-relaxed text-text-main dark:text-slate-300">"{text}"</blockquote>
              </div>
            </figure>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20">
        <h2 className="text-center text-3xl font-extrabold text-text-main dark:text-white md:text-4xl">{t('public.galleryTitle')}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-text-muted dark:text-slate-400">{t('public.gallerySubtitle')}</p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {gallery.map(({ img, alt }) => (
            <figure key={alt} className="group relative overflow-hidden rounded-2xl shadow">
              <img
                src={img}
                alt={alt}
                className="h-64 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 to-transparent px-5 pb-4 pt-12">
                <p className="text-sm font-semibold text-white">{alt}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}