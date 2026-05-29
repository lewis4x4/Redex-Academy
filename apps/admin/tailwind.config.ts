import preset from '@redex/config/tailwind-preset';
import type { Config } from 'tailwindcss';

export default {
  presets: [preset],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
} satisfies Config;
