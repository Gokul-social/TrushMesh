/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        silk: {
          bg: "#e8eaf0",
          primary: "#6366f1",
          secondary: "#7c3aed",
          text: {
            primary: "#1e1b4b",
            secondary: "#64748b",
            tertiary: "#94a3b8"
          },
          status: {
            active: "#6366f1",
            warning: "#f59e0b",
            revoked: "#ef4444",
            complete: "#10b981"
          }
        }
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "sans-serif"],
        mono: ["Space Mono", "monospace"]
      },
      boxShadow: {
        neo: "6px 6px 12px rgba(0,0,0,0.08), -6px -6px 12px rgba(255,255,255,0.6)",
        neoInset:
          "inset 4px 4px 8px rgba(0,0,0,0.06), inset -4px -4px 8px rgba(255,255,255,0.5)"
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
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" }
        }
      },
      animation: {
        ringPulse: "ringPulse 2s ease-in-out infinite",
        nodeFlash: "nodeFlash 0.9s ease-in-out",
        softPulse: "softPulse 1.8s ease-in-out infinite"
      }
    }
  },
  plugins: []
};
