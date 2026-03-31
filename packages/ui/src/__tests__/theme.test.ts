import { theme } from '../theme';

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

describe('theme.colors', () => {
  const requiredColorKeys = [
    'background',
    'foreground',
    'card',
    'cardBorder',
    'accent',
    'accentHover',
    'accentLight',
    'warmBg',
    'muted',
    'success',
    'successLight',
    'warning',
    'warningLight',
    'danger',
    'dangerLight',
    'onAccent',
  ];

  it('has all required color keys', () => {
    for (const key of requiredColorKeys) {
      expect(theme.colors).toHaveProperty(key);
    }
  });

  it('all color values are non-empty strings', () => {
    for (const [key, value] of Object.entries(theme.colors)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('all color values start with # (hex colors)', () => {
    for (const value of Object.values(theme.colors)) {
      expect(value).toMatch(/^#/);
    }
  });
});

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------

describe('theme.spacing', () => {
  it('all spacing values are numbers', () => {
    for (const value of Object.values(theme.spacing)) {
      expect(typeof value).toBe('number');
    }
  });

  it('all spacing values are positive', () => {
    for (const value of Object.values(theme.spacing)) {
      expect(value).toBeGreaterThan(0);
    }
  });

  it('spacing values increase in size (xs < sm < md < base < lg < xl)', () => {
    expect(theme.spacing.xs).toBeLessThan(theme.spacing.sm);
    expect(theme.spacing.sm).toBeLessThan(theme.spacing.md);
    expect(theme.spacing.md).toBeLessThan(theme.spacing.base);
    expect(theme.spacing.base).toBeLessThan(theme.spacing.lg);
    expect(theme.spacing.lg).toBeLessThan(theme.spacing.xl);
  });
});

// ---------------------------------------------------------------------------
// Font sizes
// ---------------------------------------------------------------------------

describe('theme.fontSize', () => {
  it('all fontSize values are numbers', () => {
    for (const value of Object.values(theme.fontSize)) {
      expect(typeof value).toBe('number');
    }
  });

  it('all fontSize values are positive', () => {
    for (const value of Object.values(theme.fontSize)) {
      expect(value).toBeGreaterThan(0);
    }
  });

  it('heading sizes increase (h3 < h2 < h1)', () => {
    expect(theme.fontSize.h3).toBeLessThan(theme.fontSize.h2);
    expect(theme.fontSize.h2).toBeLessThan(theme.fontSize.h1);
  });

  it('body is smaller than h3', () => {
    expect(theme.fontSize.body).toBeLessThan(theme.fontSize.h3);
  });

  it('caption is the smallest text size', () => {
    expect(theme.fontSize.caption).toBeLessThanOrEqual(theme.fontSize.body);
  });
});

// ---------------------------------------------------------------------------
// Border radius
// ---------------------------------------------------------------------------

describe('theme.borderRadius', () => {
  it('all borderRadius values are numbers', () => {
    for (const value of Object.values(theme.borderRadius)) {
      expect(typeof value).toBe('number');
    }
  });

  it('all borderRadius values are non-negative', () => {
    for (const value of Object.values(theme.borderRadius)) {
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it('circle is the largest borderRadius', () => {
    expect(theme.borderRadius.circle).toBeGreaterThan(theme.borderRadius.pill);
    expect(theme.borderRadius.circle).toBeGreaterThan(theme.borderRadius.button);
    expect(theme.borderRadius.circle).toBeGreaterThan(theme.borderRadius.card);
  });
});

// ---------------------------------------------------------------------------
// Font family and weight
// ---------------------------------------------------------------------------

describe('theme.fontFamily', () => {
  it('is a non-empty string', () => {
    expect(typeof theme.fontFamily).toBe('string');
    expect(theme.fontFamily.length).toBeGreaterThan(0);
  });
});

describe('theme.fontWeight', () => {
  it('has regular, medium, and bold weights', () => {
    expect(theme.fontWeight.regular).toBeDefined();
    expect(theme.fontWeight.medium).toBeDefined();
    expect(theme.fontWeight.bold).toBeDefined();
  });

  it('weights are string numbers in ascending order', () => {
    expect(Number(theme.fontWeight.regular)).toBeLessThan(Number(theme.fontWeight.medium));
    expect(Number(theme.fontWeight.medium)).toBeLessThan(Number(theme.fontWeight.bold));
  });
});
