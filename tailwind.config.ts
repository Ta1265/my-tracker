import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    'node_modules/flowbite-react/lib/esm/**/*.js',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      // Design tokens — reference CSS variables so Tailwind utilities
      // automatically reflect the active theme.
      colors: {
        'bg-primary':    'var(--bg-primary)',
        'bg-secondary':  'var(--bg-secondary)',
        'bg-card':       'var(--bg-card)',
        'bg-card-hover': 'var(--bg-card-hover)',
        'bg-elevated':   'var(--bg-elevated)',
        'bg-table':      'var(--bg-table)',
        'bg-table-hover':'var(--bg-table-hover)',
        'border-subtle': 'var(--border-subtle)',
        'border-medium': 'var(--border-medium)',
        'border-accent': 'var(--border-accent)',
        'accent-blue':   'var(--accent-blue)',
        'accent-glow':   'var(--accent-blue-glow)',
        'accent-emerald':'var(--accent-emerald)',
        'accent-red':    'var(--accent-red)',
        'text-primary':  'var(--text-primary)',
        'text-secondary':'var(--text-secondary)',
        'text-muted':    'var(--text-muted)',
        'theme-green':   'var(--green)',
        'theme-red':     'var(--red)',
        // Navigation tokens
        'nav-bg':              'var(--nav-bg)',
        'nav-border':          'var(--nav-border)',
        'nav-link-hover':      'var(--nav-link-hover-bg)',
        // Dropdown tokens
        'dropdown-bg':         'var(--dropdown-bg)',
        'dropdown-item-hover': 'var(--dropdown-item-hover)',
        // Add-transaction button tokens
        'add-btn-bg':          'var(--add-btn-bg)',
        'add-btn-border':      'var(--add-btn-border)',
        'add-btn-color':       'var(--add-btn-color)',
        'add-btn-hover-bg':    'var(--add-btn-hover-bg)',
        'add-btn-hover-border':'var(--add-btn-hover-border)',
        // User pill tokens
        'user-pill-bg':        'var(--user-pill-bg)',
        'user-pill-border':    'var(--user-pill-border)',
      },
    },
  },
  plugins: [require('tailwind-scrollbar'), require('flowbite/plugin')],
};
export default config;
