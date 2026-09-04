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
        // WCAG AA contrast fixes (product audit, Section 6): the original
        // DEFAULTs measured only ~3.1-4.1:1 against their own `-light`
        // tint backgrounds (white on bg-emerald was ~3.5:1), below the
        // 4.5:1 minimum the small badge/label text on those chips needs.
        // Each DEFAULT below is darkened in place -- same hue, lower
        // lightness -- so every existing `text-emerald` / `bg-emerald`
        // (etc.) usage in the tree now passes against both its paired
        // light tint and, for emerald (which also fills white-labelled
        // buttons), against white. No component class names change.
        emerald: {
          DEFAULT: "#15705A", // was #1B8A6B -- ~5.3:1 on emerald-light, ~6.0:1 with white text
          light: "#E4F3EE",
        },
        amber: {
          DEFAULT: "#966216", // was #C98A2E -- ~4.6:1 on amber-light
          light: "#FBF1E1",
        },
        rose: {
          DEFAULT: "#A63A35", // was #B4433E -- ~5.5:1 on rose-light
          light: "#FBEAE9",
        },
        hairline: "#E4E1D8",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        // sans and mono both point at Manrope now (see app/layout.tsx for
        // why) -- "mono" no longer means monospace, it means "the data/
        // label emphasis face," same role IBM Plex Mono used to fill.
        // Kept as a separate token rather than merged into `sans` so any
        // component still using `font-mono` for that emphasis role reads
        // the same as before without needing to change.
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
        mono: ["var(--font-manrope)", "ui-monospace", "monospace"],
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
