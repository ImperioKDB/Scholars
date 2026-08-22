import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0B1E3D",
          light: "#14315C",
          50: "#EEF2F8",
        },
        parchment: "#F7F5EF",
        ink: "#10151F",
        emerald: {
          DEFAULT: "#1B8A6B",
          light: "#E4F3EE",
        },
        amber: {
          DEFAULT: "#C98A2E",
          light: "#FBF1E1",
        },
        rose: {
          DEFAULT: "#B4433E",
          light: "#FBEAE9",
        },
        hairline: "#E4E1D8",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        seal: "9999px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,30,61,0.06), 0 1px 12px rgba(11,30,61,0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
