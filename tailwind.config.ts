import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // New brand system
        cream: "#F8F7F2",
        ink: "#20231F",
        brand: "#F47B35",
        "brand-soft": "#FFF0E5",
        "brand-deep": "#D9641F",
        lime: "#C7F36B",
        "lime-soft": "#EFFBE0",
        forest: "#315C45",
        "forest-soft": "#E8F2EC",
        muted: "#777970",
        line: "#E9E7DF",
        // Legacy names remapped to the light system (admin + secondary pages
        // continue to work without a full class rewrite)
        graphite: "#F8F7F2",
        obsidian: "#FFFFFF",
        surface: "#FFFFFF",
        bone: "#20231F",
        copper: "#F47B35",
        "copper-dim": "#D9641F",
        amber: "#FDBA74",
        wgray: "#777970",
        "wgray-dim": "#E9E7DF",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        latin: ["var(--font-latin)", "sans-serif"],
      },
      letterSpacing: {
        tightest: "-0.03em",
      },
      transitionTimingFunction: {
        cinematic: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
