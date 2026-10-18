/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        crimpston: {
          navy: '#0A192F',
          slate: '#1E293B',
          electric: '#2563EB',
          'electric-hover': '#1D4ED8',
          offwhite: '#F8FAFC',
          card: '#FFFFFF',
          border: '#E2E8F0'
        }
      }
    },
  },
  plugins: [],
}
