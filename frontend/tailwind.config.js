/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0284C7',
          hover: '#0369A1',
          25: '#f0f9ff',
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        secondary: {
          DEFAULT: '#0D9488',
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        status: {
          'confirmed-text': '#15803D',
          'confirmed-bg': '#DCFCE7',
          'pending-text': '#B45309',
          'pending-bg': '#FEF3C7',
          'cancelled-text': '#B91C1C',
          'cancelled-bg': '#FEE2E2',
        },
        navy: {
          800: '#1e293b',
          900: '#0f172a',
          950: '#0b1220',
        },
        surface: {
          DEFAULT: '#f8fafc',
          light: '#f8fafc',
          white: '#ffffff',
        },
        card: '#ffffff',
        'text-main': '#0F172A',
        'text-muted': '#64748B',
        page: '#f8fafc',
      },
      fontSize: {
        // The scale is deliberately a notch tighter than Tailwind's default: the app renders a
        // lot of dense tables and side-by-side form fields, and at the stock sizes a 375px
        // viewport could not fit a single row of them.
        'xs': ['0.75rem', { lineHeight: '1.45' }],
        'sm': ['0.8125rem', { lineHeight: '1.5' }],
        'base': ['0.9375rem', { lineHeight: '1.55' }],
        'lg': ['1.0625rem', { lineHeight: '1.5' }],
        'xl': ['1.1875rem', { lineHeight: '1.45' }],
        '2xl': ['1.4375rem', { lineHeight: '1.4' }],
        '3xl': ['1.8125rem', { lineHeight: '1.3' }],
        '4xl': ['2.25rem', { lineHeight: '1.25' }],
        '5xl': ['2.875rem', { lineHeight: '1.15' }],
        '6xl': ['3.5rem', { lineHeight: '1.05' }],
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Nunito Sans"', 'system-ui', 'sans-serif'],
        heading: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '12px',
        '2xl': '1rem',
      },
      boxShadow: {
        DEFAULT: '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
        md: '0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.05)',
        card: '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
        'card-hover': '0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.05)',
        'card-dark': '0 1px 3px 0 rgb(255 255 255 / 0.05), 0 1px 2px -1px rgb(255 255 255 / 0.05)',
        'card-dark-hover': '0 4px 16px 0 rgb(255 255 255 / 0.08)',
        dropdown: '0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.05)',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.7s ease-out forwards',
        'page-in': 'pageIn 0.35s ease-out both',
        float: 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in-right': 'slideInRight 0.22s ease-out',
        'slide-out-right': 'slideOutRight 0.18s ease-in',
        'modal-in': 'modalIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pageIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideOutRight: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(100%)' },
        },
        modalIn: {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
    },
  },
  plugins: [],
};
