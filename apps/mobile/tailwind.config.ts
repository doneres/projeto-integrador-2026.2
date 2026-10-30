import type { Config } from 'tailwindcss'
import { colors } from './src/theme/colors'

export default {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: { extend: { colors } },
} satisfies Config
