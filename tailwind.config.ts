import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#eef7ff", 100: "#d9edff", 500: "#2f7de1", 600: "#1f63c4", 700: "#1b4fa0", 900: "#122a52" },
      },
    },
  },
  plugins: [],
};
export default config;
