/**
 * NexPlay Master Design System & Theme Tokens
 * Based on the new modern Light + Crimson Red Brand Identity
 */

export const colors = {
  // Brand Crimson Red Palette
  primary: '#E50914',
  primaryDark: '#B91C1C',
  primaryLight: '#FF2E4D',
  primaryMuted: 'rgba(229, 9, 20, 0.08)',
  primaryGlow: 'rgba(229, 9, 20, 0.25)',

  // Clean White / Light Surfaces
  background: '#FFFFFF',
  backgroundSecondary: '#F9FAFB',
  backgroundTertiary: '#F3F4F6',
  cardBackground: '#FFFFFF',
  cardBorder: '#F1F5F9',
  borderLight: '#E5E7EB',
  divider: '#F3F4F6',

  // Deep Charcoal & Neutral Typography
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textMuted: '#9CA3AF',
  textLight: '#FFFFFF',

  // Cinema Dark Surfaces (for Video Player & Dark Overlays)
  playerBackground: '#000000',
  playerSurface: '#0F172A',
  playerOverlay: 'rgba(0, 0, 0, 0.75)',

  // Functional & Accents
  starYellow: '#F59E0B',
  badgeGreen: '#10B981',
  blueAccent: '#3B82F6',
  heartPink: '#EC4899',

  // Gradients
  heroGradient: [
    'rgba(0, 0, 0, 0.05)',
    'rgba(0, 0, 0, 0.3)',
    'rgba(0, 0, 0, 0.85)'
  ],
  redGradient: ['#FF2E4D', '#E50914', '#B91C1C'],
  supportBannerGradient: ['#FFE4E6', '#FECDD3'],
};

export const typography = {
  fontFamily: 'System',
  fontWeights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
    black: '900',
  }
};
