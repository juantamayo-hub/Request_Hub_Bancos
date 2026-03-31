import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      borderRadius: {
        lg: '0.5rem',
        md: '0.375rem',
        sm: '0.25rem',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        'brand-green': {
          DEFAULT: '#083D20',
          hover:   '#0a4d28',
          light:   '#E8F2EC',
        },
        'brand-navy': {
          DEFAULT: '#1F3657',
          hover:   '#253f67',
          light:   '#EEF3FA',
        },
      },
    },
  },
  plugins: [],
}

export default config
