/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dbe6fe",
          500: "#3b5fe0",
          600: "#2f4bc4",
          700: "#25399a",
        },
      },
    },
  },
  plugins: [],
};
