import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: { extend: {} },
  plugins: [require('@tailwindcss/typography')],
};

export default config;
