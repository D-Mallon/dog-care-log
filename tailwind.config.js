/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        fraunces: ["Fraunces", "serif"],
        "dm-sans": ["DM Sans", "sans-serif"],
      },
      colors: {
        "warm-brown": "var(--warm-brown)",
        "light-tan": "var(--light-tan)",
        cream: "var(--cream)",
        "text-dark": "var(--text-dark)",
        "text-muted": "var(--text-muted)",
      },
      boxShadow: {
        card: "0 4px 24px rgba(124, 62, 62, 0.08)",
      },
      scale: {
        98: "0.98",
      },
      backgroundImage: {
        "auth-pattern":
          "radial-gradient(ellipse at 20% 10%, rgba(232, 169, 106, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(143, 168, 136, 0.12) 0%, transparent 50%)",
      },
    },
  },
  plugins: [],
};
