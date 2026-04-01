# Ascension Design System

## Reference Apps

- **Oura Ring** - Dashboard layout, data visualization, streak display
- **Calm** - Onboarding flow, warm/minimal aesthetic, breathing room
- **Strava** - Activity feed, social accountability, partner views

## Design Tokens

All tokens live in `@ascension/ui` and must be imported from there. Never hardcode values.

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| `background` | `#faf9f7` | App background (warm off-white) |
| `foreground` | `#1a1a1a` | Primary text |
| `card` | `#ffffff` | Card backgrounds |
| `cardBorder` | `#e8e5e0` | Card and divider borders |
| `accent` | `#1a3a5c` | Primary buttons, links, emphasis |
| `accentHover` | `#142e4a` | Pressed/hover state for accent |
| `accentLight` | `#edf3f8` | Light accent background (selections, badges) |
| `warmBg` | `#f3f1ed` | Warm secondary background |
| `muted` | `#6b6560` | Secondary text, captions |
| `success` | `#16a34a` | Positive states (clean, streak active) |
| `warning` | `#d97706` | Caution states (flagged, evasion) |
| `danger` | `#dc2626` | Critical states (alert, relapse) |
| `successLight` | `#f0fdf4` | Success background tint |
| `warningLight` | `#fffbeb` | Warning background tint |
| `dangerLight` | `#fef2f2` | Danger background tint |
| `onAccent` | `#ffffff` | Text on accent/dark backgrounds |

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Tight gaps (dot to label) |
| `sm` | 8px | Small gaps (list items) |
| `md` | 12px | Medium gaps (input padding) |
| `base` | 16px | Default spacing (card padding, section gaps) |
| `lg` | 24px | Section spacing |
| `xl` | 32px | Large section breaks |
| `2xl` | 48px | Page-level spacing |
| `3xl` | 64px | Scroll bottom padding |

### Typography

| Token | Size | Usage |
|-------|------|-------|
| `caption` | 13px | Labels, timestamps, metadata |
| `body` | 15px | Default body text |
| `bodyLg` | 17px | Emphasized body text |
| `h3` | 20px | Section headings |
| `h2` | 24px | Card headings |
| `h1` | 32px | Screen titles |
| `display` | 64px | Large feature numbers (streak counter) |
| `iconSm` | 18px | Small icons |
| `iconMd` | 20px | Medium icons |
| `iconLg` | 22px | Large icons |
| `iconXl` | 48px | Extra large icons (empty states) |

Font: **Nunito** (regular 400, medium 500, bold 700)

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `card` | 8px | Cards, inputs |
| `button` | 12px | Buttons |
| `pill` | 24px | Badges, chips |
| `circle` | 9999px | Avatars |

### Shadows

- **subtle** - Cards at rest (opacity 0.08, radius 3)
- **elevated** - Modals, floating actions (opacity 0.12, radius 12)

## Rules

1. **Always import from `@ascension/ui`** - never use raw color hex values, pixel numbers, or inline font sizes.
2. **Use the spacing scale** - never use arbitrary numbers like `padding: 10` or `margin: 18`. Pick the nearest scale value.
3. **Use StyleSheet.create** - all styles must use React Native StyleSheet for cross-platform compatibility.
4. **Theme-first** - if a color, size, or spacing value doesn't exist in the theme, propose adding it to the theme rather than hardcoding.

## Do / Don't

```tsx
// DO - import from the design system
import { theme, Card, Button } from '@ascension/ui';

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.base,
    backgroundColor: theme.colors.background,
  },
});
```

```tsx
// DON'T - hardcode values
const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#faf9f7',
  },
});
```

```tsx
// DO - use theme colors for status
<Badge variant="success" text="Clean" />
<Badge variant="danger" text="Flagged" />
```

```tsx
// DON'T - use raw colors for status
<Text style={{ color: '#16a34a' }}>Clean</Text>
<Text style={{ color: '#dc2626' }}>Flagged</Text>
```
