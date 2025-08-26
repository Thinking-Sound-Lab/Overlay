/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
    "./src/renderer/**/*.html",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        'inter': ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      animation: {
        'blink': 'blink 1.4s infinite ease-in-out',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'wave-pulse': 'wavePulse 2s ease-in-out infinite',
      },
      keyframes: {
        blink: {
          '0%, 80%, 100%': { opacity: '0.2' },
          '40%': { opacity: '1' },
        },
        fadeIn: {
          'from': { 
            opacity: '0', 
            transform: 'translateY(5px)' 
          },
          'to': { 
            opacity: '0.8', 
            transform: 'translateY(0)' 
          },
        },
        wavePulse: {
          '0%, 100%': { 
            boxShadow: '0 0 5px rgba(255, 255, 255, 0.3)',
            transform: 'scaleX(1)' 
          },
          '50%': { 
            boxShadow: '0 0 10px rgba(255, 255, 255, 0.6)',
            transform: 'scaleX(1.1)' 
          },
        },
      },
    },
  },
  plugins: [],
};