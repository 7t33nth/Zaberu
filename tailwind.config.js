/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Manrope Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif']
      },
      // Цвета читаются из CSS-переменных (src/index.css), которые переопределяются в тёмной
      // теме — сами классы (bg-paper, text-ink, ...) от этого не меняются нигде в коде.
      // rgb(var(...) / <alpha-value>) — так Tailwind продолжает поддерживать /opacity-модификаторы.
      colors: {
        paper: 'rgb(var(--color-paper) / <alpha-value>)',
        card: 'rgb(var(--color-card) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        line: 'rgb(var(--color-line) / <alpha-value>)',
        // Заливка кнопок-CTA и модальных подложек: всегда тёмная, не инвертируется в тёмной
        // теме (иначе текст-white на ней перестанет читаться).
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        // Бренд-акцент (тёплый оранжевый) для первичных действий — см. index.css.
        brand: 'rgb(var(--color-brand) / <alpha-value>)',
        'brand-soft': 'rgb(var(--color-brand-soft) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        'accent-dark': 'rgb(var(--color-accent-dark) / <alpha-value>)',
        'accent-soft': 'rgb(var(--color-accent-soft) / <alpha-value>)',
        warn: 'rgb(var(--color-warn) / <alpha-value>)',
        'warn-soft': 'rgb(var(--color-warn-soft) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        'danger-soft': 'rgb(var(--color-danger-soft) / <alpha-value>)'
      },
      borderRadius: {
        xl2: '20px'
      }
    }
  },
  plugins: []
};
