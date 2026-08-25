import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        encre: '#1C1C1E',
        menthe: '#16A34A',
        neige: '#FAFAFA',
        graphite: '#2D2D2D',
        'graphite-light': '#3A3A3C',
        'neige-dark': '#F0F0F2',
        ambre: '#D97706',
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
      },
      borderRadius: {
        'custom-lg': '2rem',
        'custom-xl': '3rem',
      }
    },
  },
  plugins: [],
};
export default config;
