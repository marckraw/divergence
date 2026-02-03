/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sidebar: "rgb(var(--color-sidebar) / <alpha-value>)",
        main: "rgb(var(--color-main) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        text: "rgb(var(--color-text) / <alpha-value>)",
        subtext: "rgb(var(--color-subtext) / <alpha-value>)",
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        green: "rgb(var(--color-green) / <alpha-value>)",
        red: "rgb(var(--color-red) / <alpha-value>)",
        yellow: "rgb(var(--color-yellow) / <alpha-value>)",
      },
    },
  },
  plugins: [],
}
