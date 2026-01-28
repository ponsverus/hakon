/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Roboto Condensed', 'sans-serif'],
      },
      borderRadius: {
        'custom': '3px',
        'button': '9999px', // Para botões totalmente arredondados
      },
      colors: {
        primary: '#FFD700',
        dark: {
          100: '#1a1a1a',
          200: '#0d0d0d',
          300: '#000000',
        }
      }
    },
  },
  plugins: [],
}
