import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.04), 0 8px 24px -12px rgba(0,0,0,0.08)',
        'card-hover': '0 2px 8px rgba(0,0,0,0.06), 0 12px 32px -12px rgba(0,0,0,0.12)',
        focus: '0 0 0 3px rgba(37, 99, 235, 0.2)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
      },
      animation: {
        shake: 'shake 0.3s ease-in-out',
      },
      fontFamily: {
        sans: ['"Inter"', '"Noto Sans SC"', '"Source Han Sans SC"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
