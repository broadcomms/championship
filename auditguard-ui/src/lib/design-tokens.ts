/**
 * Design Tokens for AI Compliance Assistant
 * Based on UI/UX Blueprint specifications
 */

export const designTokens = {
  // Color Palette
  colors: {
    primary: {
      50: '#EFF6FF',
      100: '#DBEAFE',
      200: '#BFDBFE',
      300: '#93C5FD',
      400: '#60A5FA',
      500: '#3B82F6',
      600: '#2563EB', // Primary
      700: '#1D4ED8', // Active
      800: '#1E40AF',
      900: '#1E3A8A',
    },
    semantic: {
      success: '#22C55E',
      warning: '#EAB308',
      error: '#EF4444',
      ai: '#A855F7', // AI/Intelligence accent
    },
    neutral: {
      50: '#F9FAFB',
      100: '#F3F4F6',
      200: '#E5E7EB',
      300: '#D1D5DB',
      400: '#9CA3AF',
      500: '#6B7280',
      600: '#4B5563',
      700: '#374151',
      800: '#1F2937',
      900: '#111827',
    },
  },

  // Typography
  typography: {
    fontFamily: {
      base: 'Inter, system-ui, sans-serif',
    },
    fontSize: {
      xs: '12px',
      sm: '14px',
      base: '16px',
      lg: '18px',
      xl: '20px',
      '2xl': '24px',
      '3xl': '30px',
      '4xl': '36px',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
    letterSpacing: {
      tighter: '-0.02em',
      tight: '-0.01em',
      normal: '0',
      wide: '0.01em',
    },
  },

  // Spacing System (4px base unit)
  spacing: {
    xs: '4px',   // 1 unit
    sm: '8px',   // 2 units
    md: '16px',  // 4 units
    lg: '24px',  // 6 units
    xl: '32px',  // 8 units
    '2xl': '48px', // 12 units
    '3xl': '64px', // 16 units
  },

  // Border Radius
  borderRadius: {
    none: '0',
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },

  // Shadows
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.15)',
    '2xl': '0 25px 50px rgba(0, 0, 0, 0.25)',
  },

  // Transitions
  transitions: {
    fast: '150ms ease',
    base: '200ms ease',
    slow: '300ms ease',
  },

  // Z-Index Scale
  zIndex: {
    base: 0,
    dropdown: 10,
    sticky: 20,
    modal: 30,
    popover: 40,
    tooltip: 50,
  },

  // Breakpoints
  breakpoints: {
    mobile: '375px',
    tablet: '768px',
    desktop: '1024px',
    wide: '1920px',
  },

  // Layout Dimensions
  layout: {
    conversationSidebar: '280px',
    detailsSidebar: '320px',
    chatWidgetWidth: '400px',
    chatWidgetHeight: '600px',
    headerHeight: '64px',
  },
} as const;

// Export type-safe design token types
export type DesignTokens = typeof designTokens;
export type ColorToken = keyof typeof designTokens.colors;
export type SpacingToken = keyof typeof designTokens.spacing;
