/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        hakon: '#EAB308', // Amarelo Hakon
      }
    },
  },
  plugins: [],
}
