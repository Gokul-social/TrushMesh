/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        silk: {
          bg: "rgb(var(--tm-color-bg) / <alpha-value>)",
          primary: "rgb(var(--tm-color-primary) / <alpha-value>)",
          secondary: "rgb(var(--tm-color-secondary) / <alpha-value>)",
          text: {
            primary: "rgb(var(--tm-color-text-primary) / <alpha-value>)",
            secondary: "rgb(var(--tm-color-text-secondary) / <alpha-value>)",
            tertiary: "rgb(var(--tm-color-text-tertiary) / <alpha-value>)"
          },
          status: {
            active: "rgb(var(--tm-color-status-active) / <alpha-value>)",
            warning: "rgb(var(--tm-color-status-warning) / <alpha-value>)",
            revoked: "rgb(var(--tm-color-status-revoked) / <alpha-value>)",
            complete: "rgb(var(--tm-color-status-complete) / <alpha-value>)"
          }
        }
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "sans-serif"],
        mono: ["Space Mono", "monospace"]
      },
      boxShadow: {
        neo: "var(--tm-shadow-neo)",
        neoInset: "var(--tm-shadow-neo-inset)"
      },
      borderRadius: {
        silk: "18px"
      },
      keyframes: {
        ringPulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" }
        },
        nodeFlash: {
          "0%": { filter: "brightness(1)" },
          "50%": { filter: "brightness(1.45)" },
          "100%": { filter: "brightness(1)" }
        },
        softPulse: {
          "0%, 100%": { opacity: "0.78" },
          "50%": { opacity: "1" }
        }
      },
      animation: {
        ringPulse: "ringPulse 2.5s ease-in-out infinite",
        nodeFlash: "nodeFlash 0.9s ease-in-out",
        softPulse: "softPulse 2.4s ease-in-out infinite"
      }
    }
  },
  plugins: []
};
