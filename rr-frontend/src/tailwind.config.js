// tailwind.config.js
module.exports = {
  darkMode: 'class',            // ← class-based dark mode
  content: ['./src/**/*.{js,jsx,ts,tsx}'],  // ← purge unused styles
  theme: {
    extend: {
      colors: {
        // your brand palette
        brand: {
          primary: '#1E3A8A',
          secondary: '#F59E0B',
          accent: '#10B981',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        serif: ['Merriweather', 'serif'],
      },
      spacing: {
        // example for a fluid spacing scale
        'fluid-sm': 'clamp(0.5rem, 1vw, 0.75rem)',
        'fluid-md': 'clamp(1rem, 2vw, 1.5rem)',
        'fluid-lg': 'clamp(1.5rem, 3vw, 2rem)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
    require('@tailwindcss/aspect-ratio'),
  ],
};
