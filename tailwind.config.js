/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sand: '#f5eee6',
        pomegranate: '#c1440e',
        clay: '#b26b4b',
        olive: '#4a5f2a',
        midnight: '#1f1a17',
        copper: '#d6a77a',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'levant-pattern':
          'radial-gradient(circle at 10px 10px, rgba(255,255,255,0.06) 2px, transparent 0)',
      },
    },
  },
  plugins: [],
}

