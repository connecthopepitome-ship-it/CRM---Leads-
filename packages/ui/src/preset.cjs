/** Tailwind preset mapping the CSS-variable tokens; components never use raw hex values. */
const c = (v) => `rgb(var(--color-${v}) / <alpha-value>)`;
module.exports = {
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    screens: { xs: '360px', sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px' },
    extend: {
      colors: {
        bg: c('bg'), surface: c('surface'), 'surface-2': c('surface-2'), text: c('text'), muted: c('text-muted'), border: c('border'), 'border-input': c('border-input'),
        primary: { DEFAULT: c('primary'), hover: c('primary-hover'), fg: c('primary-fg'), subtle: c('primary-subtle') },
        success: { DEFAULT: c('success'), subtle: c('success-subtle') }, warning: { DEFAULT: c('warning'), subtle: c('warning-subtle') },
        danger: { DEFAULT: c('danger'), subtle: c('danger-subtle') }, info: c('info'), overlay: c('overlay'),
      },
      borderRadius: { sm: 'var(--radius-sm)', md: 'var(--radius-md)', lg: 'var(--radius-lg)' },
      boxShadow: { 1: 'var(--shadow-1)', 2: 'var(--shadow-2)', 3: 'var(--shadow-3)' },
      transitionDuration: { fast: 'var(--motion-fast)', base: 'var(--motion-base)', slow: 'var(--motion-slow)' },
      fontFamily: { sans: ['Inter', 'Noto Sans', 'system-ui', 'sans-serif'] },
      minHeight: { touch: '44px' }, minWidth: { touch: '44px' },
    },
  },
};
