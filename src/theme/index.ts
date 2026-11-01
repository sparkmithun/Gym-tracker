export const colors = {
  bg: '#0E0F12',
  surface: '#17191E',
  surfaceAlt: '#20232A',
  border: '#2A2E37',
  text: '#F2F4F8',
  textDim: '#9AA3B2',
  textMuted: '#646C7A',
  primary: '#3D8BFF',
  primaryDim: '#1D3B66',
  success: '#2FBF71',
  successDim: '#123D27',
  warning: '#F5A524',
  danger: '#F04F5A',
  warmup: '#F5A524',
  drop: '#A970FF',
  failure: '#F04F5A',
  gold: '#FFC94A',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 14, pill: 999 } as const;
export const font = {
  h1: { fontSize: 28, fontWeight: '800' as const },
  h2: { fontSize: 22, fontWeight: '700' as const },
  h3: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  small: { fontSize: 13, fontWeight: '400' as const },
  tiny: { fontSize: 11, fontWeight: '600' as const },
};

// Distinct colours for superset groups.
export const supersetColors = ['#3D8BFF', '#A970FF', '#2FBF71', '#F5A524', '#F04F5A', '#22C3D6'];
