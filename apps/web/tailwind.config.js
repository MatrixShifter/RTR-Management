/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      colors: {
        sky: {
          50: '#F4F9FF',
          100: '#EAF4FF',
          200: '#D8E7F7',
          300: '#A8D2FC',
          400: '#53A8FD',
          500: '#168BFF',
          600: '#0876E8',
          700: '#065EC2',
          800: '#074E9D',
          900: '#0B427F'
        },
        crimpston: {
          navy: '#0B192C',
          slate: '#1E293B',
          electric: '#168BFF',
          'electric-hover': '#0876E8',
          offwhite: '#F4F9FF',
          card: '#FFFFFF',
          border: '#D8E7F7'
        }
      }
    },
  },
  plugins: [],
}
