import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--color-background) / <alpha-value>)',
        foreground: 'rgb(var(--color-foreground) / <alpha-value>)',
        card: 'rgb(var(--color-card) / <alpha-value>)',
        'card-foreground': 'rgb(var(--color-card-foreground) / <alpha-value>)',
        popover: 'rgb(var(--color-popover) / <alpha-value>)',
        'popover-foreground': 'rgb(var(--color-popover-foreground) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        'muted-foreground': 'rgb(var(--color-muted-foreground) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        'accent-foreground': 'rgb(var(--color-accent-foreground) / <alpha-value>)',
        destructive: 'rgb(var(--color-destructive) / <alpha-value>)',
        'destructive-foreground': 'rgb(var(--color-destructive-foreground) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        input: 'rgb(var(--color-input) / <alpha-value>)',
        ring: 'rgb(var(--color-ring) / <alpha-value>)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
};

export default config;
