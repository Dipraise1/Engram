export const C = {
  // Backgrounds
  bg:       '#05050B',
  bgCard:   '#0C0C18',
  bgCard2:  '#111122',
  bgInput:  '#0A0A16',

  // Borders
  border:   'rgba(255,255,255,0.07)',
  borderMd: 'rgba(255,255,255,0.12)',
  borderAct:'rgba(124,58,237,0.55)',

  // Brand
  purple:   '#7C3AED',
  purpleL:  '#A855F7',
  purpleD:  'rgba(124,58,237,0.14)',
  purpleGlow:'rgba(124,58,237,0.25)',

  // Accents
  cyan:     '#06B6D4',
  cyanD:    'rgba(6,182,212,0.12)',
  green:    '#22C55E',
  greenD:   'rgba(34,197,94,0.12)',
  amber:    '#F59E0B',
  amberD:   'rgba(245,158,11,0.12)',
  red:      '#EF4444',
  redD:     'rgba(239,68,68,0.12)',

  // Text
  text:     '#F1F1F8',
  textSub:  '#9CA3AF',
  textDim:  '#4B5563',
  textMono: '#A78BFA',
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  full: 999,
} as const;

// Elevation presets — soft shadows that read against the near-black background.
export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  glow: {
    shadowColor: C.purple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 10,
  },
} as const;
