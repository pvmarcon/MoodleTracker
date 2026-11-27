/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'ui-serif', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        bg: token('bg'),
        panel: token('panel'),
        raised: token('raised'),
        line: token('line'),
        fg: token('fg'),
        muted: token('muted'),
        subtle: token('subtle'),
        accent: token('accent'),
        mint: token('mint'),
        amber: token('amber'),
        rose: token('rose'),
        sky: token('sky'),
      },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
        blink: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0' } },
        drift: {
          '0%': { transform: 'translate(-10%, -6%) scale(1)' },
          '50%': { transform: 'translate(8%, 4%) scale(1.15)' },
          '100%': { transform: 'translate(-10%, -6%) scale(1)' },
        },
        shimmer: { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
        dot: { '0%,80%,100%': { opacity: '.25', transform: 'scale(.8)' }, '40%': { opacity: '1', transform: 'scale(1)' } },
        grow: { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
      },
      animation: {
        rise: 'rise 420ms cubic-bezier(.2,.8,.2,1) both',
        fade: 'fade 300ms ease-out both',
        blink: 'blink 1s step-end infinite',
        drift: 'drift 18s ease-in-out infinite',
        shimmer: 'shimmer 2.2s linear infinite',
        dot: 'dot 1.2s ease-in-out infinite',
        grow: 'grow 700ms cubic-bezier(.2,.8,.2,1) both',
      },
    },
  },
  plugins: [],
};
