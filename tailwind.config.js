/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'sidebar': '#1e1e2e',
        'main': '#181825',
        'surface': '#313244',
        'text': '#cdd6f4',
        'subtext': '#a6adc8',
        'accent': '#89b4fa',
        'green': '#a6e3a1',
        'red': '#f38ba8',
        'yellow': '#f9e2af',
      },
    },
  },
  plugins: [],
}
