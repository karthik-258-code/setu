import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
        },
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
