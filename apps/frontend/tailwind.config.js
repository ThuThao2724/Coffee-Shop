/** @type {import('tailwindcss').Config} */

// "Espresso & vàng đồng" theme. The whole UI is written with the amber (accent) and slate/gray
// (neutral) families, so the theme is applied by redefining those palettes here instead of
// editing every page:
//   amber  -> bronze gold accent (buttons, active items, highlights)
//   slate  -> warm espresso neutrals (text, borders, dark-mode surfaces)
//   gray   -> same neutrals, so older pages that use gray match
// Status colours (sky, emerald, rose, indigo) keep Tailwind's defaults.
const bronze = {
  50: '#fbf7f0',
  100: '#f5ecdc',
  200: '#ead7b5',
  300: '#dcbc88',
  400: '#cba061',
  500: '#b8894a',
  600: '#9c6f36',
  700: '#7d572b',
  800: '#5f4223',
  900: '#45301a',
  950: '#2a1d10',
}

const espresso = {
  50: '#faf7f3',
  100: '#f3eee8',
  200: '#e6ded5',
  300: '#d2c6ba',
  400: '#a89a8c',
  500: '#7d6e62',
  600: '#5e5148',
  700: '#463b34',
  800: '#2f2722',
  900: '#221b17',
  950: '#16110e',
}

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        amber: bronze,
        primary: bronze,
        slate: espresso,
        gray: espresso,
        espresso: {
          ...espresso,
          sidebar: '#2b1d14',
          'sidebar-soft': '#3a2a1f',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
