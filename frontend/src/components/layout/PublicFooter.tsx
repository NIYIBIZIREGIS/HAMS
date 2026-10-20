import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HeartPulse, Mail, Phone, MapPin } from 'lucide-react';

export function PublicFooter() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-card dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Link to="/" className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
                <HeartPulse className="h-5 w-5" />
              </span>
              <span className="text-lg font-bold text-text-main dark:text-white">HAS</span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-text-muted dark:text-slate-400">{t('landing.footerText')}</p>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-text-main dark:text-white">HAS</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/about" className="text-text-muted transition-colors hover:text-text-main dark:text-slate-400 dark:hover:text-white">About Us</Link></li>
              <li><Link to="/how-it-works" className="text-text-muted transition-colors hover:text-text-main dark:text-slate-400 dark:hover:text-white">How it works</Link></li>
              <li><Link to="/comments" className="text-text-muted transition-colors hover:text-text-main dark:text-slate-400 dark:hover:text-white">Comments</Link></li>
              <li><Link to="/register" className="text-text-muted transition-colors hover:text-text-main dark:text-slate-400 dark:hover:text-white">Create account</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-text-main dark:text-white">{t('landing.footerSupport')}</h3>
            <ul className="space-y-2 text-sm text-text-muted dark:text-slate-400">
              {[
                { to: '/help', label: t('help.navHelpCenter') },
                { to: '/faq', label: t('help.navFaqs') },
                { to: '/privacy-policy', label: t('legal.navPrivacy') },
                { to: '/terms-of-service', label: t('legal.navTerms') },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="transition-colors hover:text-text-main dark:hover:text-white">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-text-main dark:text-white">Contact</h3>
            <ul className="space-y-3 text-sm text-text-muted dark:text-slate-400">
              <li className="flex items-center gap-2"><Mail className="h-4 w-4 shrink-0" /> support@has.local</li>
              <li className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0" /> +250 788 000 000</li>
              <li className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0" /> Kigali, Rwanda</li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-slate-100 pt-6 text-center text-sm text-slate-400 dark:border-slate-800 dark:text-slate-500">
          © {year} HAS — {t('landing.footerBuiltWith')} <HeartPulse className="inline h-3.5 w-3.5" /> Rwanda
        </div>
      </div>
    </footer>
  );
}