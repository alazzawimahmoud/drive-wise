/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f7ff',
          100: '#ebf0fe',
          200: '#ced9fd',
          300: '#b1c2fb',
          400: '#7694f9',
          500: '#3b66f6',
          600: '#355cdd',
          700: '#2c4da9',
          800: '#233d87',
          900: '#1d326e',
        },
      },
    },
  },
  plugins: [],
}
