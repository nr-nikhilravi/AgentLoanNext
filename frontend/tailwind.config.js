/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
        mono: ["JetBrains Mono", "ui-monospace"],
      },
      colors: {
        // Future Bank of India brand
        electric: {
          50:  "#EBF1FF",
          100: "#D6E2FF",
          400: "#3D6CFF",
          500: "#0047FF",
          600: "#003BD6",
          700: "#002CA6",
        },
        teal: {
          50:  "#E6FAF6",
          400: "#33CFB7",
          500: "#00BFA5",
          600: "#00A48C",
          700: "#008671",
        },
        // Warm-grey neutrals (Stone palette)
        warm: {
          50:  "#FAFAF9",
          100: "#F5F5F4",
          200: "#E7E5E4",
          300: "#D6D3D1",
          400: "#A8A29E",
          500: "#78716C",
          600: "#57534E",
          700: "#44403C",
          800: "#292524",
          900: "#1C1917",
        },
      },
      keyframes: {
        pulseDot: {
          "0%, 100%": { opacity: "0.3" },
          "50%": { opacity: "1" },
        },
        circuit: {
          "0%": { strokeDashoffset: "0" },
          "100%": { strokeDashoffset: "-40" },
        },
      },
      animation: {
        pulseDot: "pulseDot 1.4s ease-in-out infinite",
        circuit: "circuit 3s linear infinite",
      },
    },
  },
  plugins: [],
};
