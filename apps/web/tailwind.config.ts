import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        slate: {
          50: "#f5f7f3",
          100: "#edf1eb",
          200: "#dce5dc",
          300: "#c5d2c5",
          400: "#9aab9c",
          500: "#6c7b6e",
          600: "#526254",
          700: "#384a3b",
          800: "#26382b",
          900: "#18271d",
        },
        brand: {
          50: "#eaf4ed",
          100: "#d5e9da",
          200: "#b9d9c2",
          300: "#8fbda0",
          600: "#26704c",
          700: "#1e5d3d",
          800: "#174a31",
          900: "#103b26",
          950: "#0c2f1e",
        },
        accent: { 50: "#fff6e4", 100: "#f8e7bd", 700: "#865b12", 800: "#66430b" },
      },
      boxShadow: {
        soft: "0 1px 2px rgb(24 39 29 / 5%), 0 8px 22px rgb(24 39 29 / 5%)",
        lift: "0 12px 30px rgb(24 39 29 / 10%)",
      },
      // System fonts only: no web fonts, no CDNs (ARCHITECTURE 12). Android ships a Telugu face.
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Noto Sans",
          "Noto Sans Telugu",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
