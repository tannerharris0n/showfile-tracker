// ╔══════════════════════════════════════════════════════════════╗
// ║  THEME — Lighting-industry vibe                              ║
// ║                                                              ║
// ║  Dark default (consoles live in dark venues).                ║
// ║  Light toggle for office/daylight reviewing.                 ║
// ║  Warm amber accent — like the tungsten/sodium of a stage.    ║
// ╚══════════════════════════════════════════════════════════════╝

const DARK = {
  mode: 'dark',
  bg: '#0d0c0a',
  surface: '#15140f',
  surfaceAlt: '#1d1b15',
  hover: '#23211a',

  border: '#2b281f',
  borderHover: '#3a3628',
  borderActive: '#f0b557',

  text: '#f4ede0',
  textBody: '#d8d0bf',
  textDim: '#8a8270',
  textFaint: '#5a5448',
  textInverse: '#0d0c0a',

  accent: '#f0b557',         // warm amber
  accentDim: 'rgba(240,181,87,0.10)',
  accentBorder: 'rgba(240,181,87,0.35)',
  accentText: '#1a1408',

  green: '#7fb069',
  greenDim: 'rgba(127,176,105,0.10)',
  greenBorder: 'rgba(127,176,105,0.30)',

  amber: '#f0b557',
  amberDim: 'rgba(240,181,87,0.10)',
  amberBorder: 'rgba(240,181,87,0.30)',

  red: '#e2725b',
  redDim: 'rgba(226,114,91,0.10)',
  redBorder: 'rgba(226,114,91,0.30)',

  blue: '#7aa6c8',
  blueDim: 'rgba(122,166,200,0.10)',
  blueBorder: 'rgba(122,166,200,0.30)',

  purple: '#b08ed1',
  purpleDim: 'rgba(176,142,209,0.10)',
};

const LIGHT = {
  mode: 'light',
  bg: '#faf7f0',
  surface: '#ffffff',
  surfaceAlt: '#f2eee3',
  hover: '#ece7d8',

  border: '#e1dccd',
  borderHover: '#c8c1ac',
  borderActive: '#1a1408',

  text: '#1a1408',
  textBody: '#3d342a',
  textDim: '#7a6f5a',
  textFaint: '#a59a82',
  textInverse: '#faf7f0',

  accent: '#b8761e',
  accentDim: 'rgba(184,118,30,0.08)',
  accentBorder: 'rgba(184,118,30,0.30)',
  accentText: '#ffffff',

  green: '#4f7a2f',
  greenDim: 'rgba(79,122,47,0.08)',
  greenBorder: 'rgba(79,122,47,0.30)',

  amber: '#b8761e',
  amberDim: 'rgba(184,118,30,0.08)',
  amberBorder: 'rgba(184,118,30,0.30)',

  red: '#a83a25',
  redDim: 'rgba(168,58,37,0.08)',
  redBorder: 'rgba(168,58,37,0.30)',

  blue: '#3d6480',
  blueDim: 'rgba(61,100,128,0.08)',
  blueBorder: 'rgba(61,100,128,0.30)',

  purple: '#6e4b8f',
  purpleDim: 'rgba(110,75,143,0.08)',
};

let currentTheme = DARK;

export function getTheme() { return currentTheme; }

export function setThemeMode(mode) {
  currentTheme = mode === 'light' ? LIGHT : DARK;
  if (typeof window !== 'undefined') {
    try { localStorage.setItem('showfile_theme', currentTheme.mode); } catch (e) {}
    document.body.style.background = currentTheme.bg;
    document.body.style.color = currentTheme.text;
  }
  return currentTheme;
}

export function initTheme() {
  if (typeof window === 'undefined') return DARK;
  let saved = null;
  try { saved = localStorage.getItem('showfile_theme'); } catch (e) {}
  currentTheme = saved === 'light' ? LIGHT : DARK;
  document.body.style.background = currentTheme.bg;
  document.body.style.color = currentTheme.text;
  return currentTheme;
}

// Re-export the current theme object via a getter pattern. Components subscribe
// by holding state — see App.jsx setTheme/useState.
export const fonts = {
  body: "'Inter', 'DM Sans', 'Helvetica Neue', sans-serif",
  mono: "'JetBrains Mono', 'DM Mono', 'Menlo', monospace",
};

export const fontImport = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');`;

export const keyframes = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
`;

export function baseStyles(T) {
  return `
    ${fontImport}
    ${keyframes}
    * { box-sizing: border-box; margin: 0; }
    html, body, #root { min-height: 100%; }
    body {
      background: ${T.bg};
      color: ${T.text};
      font-family: ${fonts.body};
      -webkit-font-smoothing: antialiased;
      transition: background 0.2s ease, color 0.2s ease;
    }
    input:focus, textarea:focus, select:focus {
      border-color: ${T.accent} !important;
      box-shadow: 0 0 0 3px ${T.accentDim};
      outline: none;
    }
    ::selection { background: ${T.accentDim}; color: ${T.text}; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: ${T.borderHover}; }
    a { text-decoration: none; color: inherit; }
    button { font-family: inherit; }
  `;
}

// Console family display config — colors, labels, suggested file formats.
export const CONSOLE_FAMILIES = {
  eos:      { label: 'Eos',       color: '#5b9bd5', formats: ['.esf', '.esf3', '.show'] },
  ma2:      { label: 'MA2',       color: '#d97757', formats: ['.show'] },
  ma3:      { label: 'MA3',       color: '#e08b3c', formats: ['.show3'] },
  avolites: { label: 'Avolites',  color: '#b85cb8', formats: ['.lpx', '.avo'] },
  hog4:     { label: 'Hog 4',     color: '#7ab877', formats: ['.shw'] },
  chamsys:  { label: 'ChamSys',   color: '#d4a23e', formats: ['.msq'] },
  onyx:     { label: 'Onyx',      color: '#9b7ed6', formats: ['.onyx'] },
  other:    { label: 'Other',     color: '#8a8270', formats: [] },
};

export const CONSOLE_KEYS = Object.keys(CONSOLE_FAMILIES);
