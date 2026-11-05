/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        centizen: {
          navy: '#0A5482',
          'navy-dark': '#073B5B',
          'navy-light': '#E6F0F8',
          orange: '#F27E20',
          'orange-hover': '#D96810',
          'orange-light': '#FEF3EB',
          bg: '#F8FAFC',
          card: '#FFFFFF',
          border: '#E2E8F0',
        }
      }
    },
  },
  plugins: [],
}

