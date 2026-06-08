// === Rezzies Design Tokens ===
// Locked v2 palette per Style Spec Doc (cmpze514302chs6013gkajwqr) +
// V2 Visual Mockup (cmq4pc61f0023s6012xi1uoh9). Direction A: teal #14B8A6.
// Dark mode is default; light mode is provided for accessibility but unused
// in the first-7-day surfaces.

export type ColorTokens = {
  bg: string;          // root canvas
  surface: string;     // cards, sheets
  elev: string;        // elevated surfaces (modals, hover)
  border: string;      // hairline + dividers
  text: string;        // primary text
  text2: string;       // secondary text
  text3: string;       // tertiary / muted
  primary: string;     // dominant brand (orange — accent CTAs, streak)
  primarySoft: string; // pressed / focus halo for primary
  secondary: string;   // success / completion (teal)
  secondary2: string;  // hover / pressed
  secondarySoft: string; // selected box fill at low alpha
  success: string;
  warn: string;
  danger: string;
};

// Dark map — default for the app (matches V2 doc locked tokens exactly)
const dark: ColorTokens = {
  bg: '#0A0A0A',
  surface: '#161616',
  elev: '#222222',
  border: '#2A2A2A',
  text: '#FAFAFA',
  text2: '#A3A3A3',
  text3: '#737373',
  primary: '#F85C1E',
  primarySoft: '#F85C1E33', // 20% alpha
  secondary: '#14B8A6',
  secondary2: '#2DD4BF',
  secondarySoft: '#14B8A61F', // ~12% alpha per v2 doc
  success: '#22C55E',
  warn: '#F59E0B',
  danger: '#EF4444',
};

// Light map (accessibility / future use — locked per v2 doc)
const light: ColorTokens = {
  bg: '#FAFAFA',
  surface: '#FFFFFF',
  elev: '#F5F5F5',
  border: '#E5E5E5',
  text: '#0F172A',
  text2: '#475569',
  text3: '#94A3B8',
  primary: '#EA580C',
  primarySoft: '#EA580C1A',
  secondary: '#0D9488',
  secondary2: '#14B8A6',
  secondarySoft: '#0D94881A',
  success: '#16A34A',
  warn: '#D97706',
  danger: '#DC2626',
};

export const colors = { dark, light };

// Default export — every screen reads from this until we wire a theme provider.
export const c = dark;

// === Spacing scale (8pt grid) ===
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};

// === Radius scale ===
export const radii = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999,
};

// === Typography ===
// Rounded Mplus 1c Bold per Style Spec; fallback to system rounded font.
export const fonts = {
  display: 'System',
  body: 'System',
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semi: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
  },
};

export const text = {
  hero: { fontSize: 48, lineHeight: 52, fontWeight: '800' as const },
  h1: { fontSize: 32, lineHeight: 38, fontWeight: '800' as const },
  h2: { fontSize: 24, lineHeight: 30, fontWeight: '700' as const },
  h3: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const },
  bodyLg: { fontSize: 17, lineHeight: 24, fontWeight: '500' as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '500' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '600' as const },
};

// === Motion ===
// Spring presets — used by reanimated withSpring()
export const motion = {
  ringFill: { damping: 14, stiffness: 100, mass: 0.9 },
  pop: { damping: 10, stiffness: 180, mass: 0.7 },
  press: { damping: 18, stiffness: 220, mass: 0.6 },
};

// === Shadows (used on dark — subtle) ===
export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  pop: {
    shadowColor: '#F85C1E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
};

// === Ring configuration ===
// 5-segment ring per v2 mockup — segments separated by small gaps.
// Two-state fill (TYC-137, chairman directive 2026-06-08):
//   • PARTIAL progress  -> orange (#F85C1E) — aggregate-progress signal,
//     matches streak + monthly bonus.
//   • FULL completion   -> teal   (#14B8A6) — celebrates the daily close,
//     consistent with the per-row completed state.
// Style Spec §6.1 specifies --rz-primary for ring fill in the steady state;
// the full-completion teal is an explicit semantic accent on top.
export const ring = {
  segments: 5,
  gapDeg: 10,        // visual gap between segments
  size: 200,
  stroke: 12,
  trackColor: '#2A2A2A',
  fillColor: '#F85C1E',         // partial-progress orange
  fillColorComplete: '#14B8A6', // full-completion teal (matches row + tab)
};

export const tokens = {
  colors,
  c,
  space,
  radii,
  fonts,
  text,
  motion,
  shadow,
  ring,
};

export default tokens;
