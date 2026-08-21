/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        base: '#0A0E12',
        panel: '#141A22',
        'panel-raised': '#1B232E',
        edge: '#242F3D',
        accent: '#4CE0D2',
        'accent-dim': '#2B7A73',
        warning: '#FFB347',
        ink: '#E8ECEF',
        'ink-muted': '#8A97A3'
      },
      fontFamily: {
        sans: ['Sora', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace']
      },
      transitionDuration: {
        fast: '150ms',
        normal: '200ms'
      }
    }
  },
  plugins: []
}
