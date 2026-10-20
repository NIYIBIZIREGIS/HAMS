import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import fr from './fr.json';
import rw from './rw.json';

const stored = localStorage.getItem('has_lang') ?? 'en';

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    rw: { translation: rw },
  },
  lng: stored,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export function setLanguage(lang: string) {
  localStorage.setItem('has_lang', lang);
  void i18n.changeLanguage(lang);
}

export default i18n;
