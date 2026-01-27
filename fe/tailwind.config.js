// Tailwind design tokens: enable dark mode via class and custom brand palette.
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0D26CF', // Blue
          hover: '#0A1FA3',   // Darker Blue
          light: '#3D54E6',   // Lighter Blue
        },
        sidebar: {
          bg: '#08107B',      // Deep Navy
          text: '#ffffff',    // White
          active: '#0D26CF',  // Blue
        },
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.1s ease-out forwards',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
