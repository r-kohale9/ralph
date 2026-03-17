# MathAI CSS Color Guidelines

Quick reference for all colors used in MathAI game interfaces.

---

## CSS Variables

```css
:root {
    /* Primary Brand Colors */
    --primary: #270f36;
    --level-text: #270F63;
    --purple: #9B51E0;

    /* Action Colors */
    --green: #219653;
    --blue: #667eea;
    --red: #E35757;
    --orange: #F2994A;
    --yellow: #FFDE49;

    /* Neutral Colors */
    --white: #ffffff;
    --gray: #666666;
    --light-gray: #f5f5f5;
    --disabled-gray: #E0E0E0;

    /* Gameplay Cell Backgrounds */
    --cell-bg-green: #D9F8D9;
    --cell-bg-yellow: #FCF6D7;
    --cell-bg-red: #FFD9D9;
    --cell-bg-grey: #E0E0E0;

    /* Gameplay Cell Borders */
    --cell-border-green: #27ae60;
    --cell-border-red: #e74c3c;
}
```

---

## Color Reference

### Primary & Branding

| Color | Hex | Variable | Usage |
|-------|-----|----------|-------|
| Dark Purple | `#270f36` | `--primary` | Main branding, titles, headings |
| Purple | `#270F63` | `--level-text` | Level/Round screen titles |
| Light Purple | `#9B51E0` | `--purple` | Version badges, accents |

### Buttons

| Color | Hex | Variable | Usage |
|-------|-----|----------|-------|
| Green | `#219653` | `--green` | Primary buttons (confirm, start, claim) |
| Blue | `#667eea` | `--blue` | Secondary buttons (retry, alternative) |
| Red | `#E35757` | `--red` | Danger buttons (destructive actions) |
| Orange | `#F2994A` | `--orange` | Warning buttons |

### Gameplay Cells - Backgrounds

| Color | Hex | Variable | Usage |
|-------|-----|----------|-------|
| Light Green | `#D9F8D9` | `--cell-bg-green` | Correct answer |
| Light Yellow | `#FCF6D7` | `--cell-bg-yellow` | Selected cell |
| Light Red | `#FFD9D9` | `--cell-bg-red` | Incorrect answer |
| Light Gray | `#E0E0E0` | `--cell-bg-grey` | Disabled cell |

### Gameplay Cells - Borders

| Color | Hex | Variable | Usage |
|-------|-----|----------|-------|
| Green | `#27AE60` | `--cell-border-green` | Correct answer border |
| Red | `#e74C3C` | `--cell-border-red` | Incorrect answer border |
| Dark Gray | `#A9A9A9` | - | Disabled cell border |
| Light Gray | `#E0E0E0` | - | Default cell border |

### Text Colors

| Color | Hex | Variable | Usage |
|-------|-----|----------|-------|
| Black | `#000000` | - | Default text |
| Dark Gray | `#6A6A6A` | - | Secondary text |
| Gray | `#666666` | `--gray` | Subtitles, supporting text |
| Light Gray | `#B4B4B4` | - | Disabled text |
| Purple | `#270F63` | `--level-text` | Level/Round titles |

### Stars

| Color | Hex | Variable | Usage |
|-------|-----|----------|-------|
| Yellow | `#FFDE49` | `--yellow` | Active star fill |
| Light Yellow | `#ffff8d` | - | Star highlight (SVG) |
| Dark Yellow | `#f4b400` | - | Star shadow (SVG) |
| Light Gray | `#E0E0E0` | `--disabled-gray` | Inactive star |

### Backgrounds

| Color | Hex | Variable | Usage |
|-------|-----|----------|-------|
| White | `#ffffff` | `--white` | Modals, cards |
| Very Light Gray | `#f5f5f5` | `--light-gray` | Sections |
| Light Gray | `#f8f8f8` | - | Progress section |

### Gradients

```css
/* Action Bar / Page Background */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Demo Buttons */
background: linear-gradient(135deg, #270f36 0%, #9B51E0 100%);

/* Icon Preview */
background: linear-gradient(135deg, #f8f9ff 0%, #fef9f8 100%);

/* Star Preview */
background: linear-gradient(135deg, #fff9e6 0%, #fff5cc 100%);
```

### Borders

| Color | Hex | Usage |
|-------|-----|-------|
| Light Gray | `#e0e0e0` | Section dividers, standard borders |
| Very Light Gray | `#f0f0f0` | Card title dividers |
| Blue | `#667eea` | Accent borders, flow steps |

### Other UI Elements

**Progress Bar:**
- Container: `#e5e7eb`
- Fill: `#2563eb`

**Tags:**
- Success: `rgba(33, 150, 83, 0.1)` bg, `#219653` text
- Info: `rgba(102, 126, 234, 0.1)` bg, `#667eea` text
- Warning: `rgba(242, 153, 74, 0.1)` bg, `#F2994A` text
- Error: `rgba(227, 87, 87, 0.1)` bg, `#E35757` text

**Overlays:**
- Modal overlay: `rgba(0, 0, 0, 0.6)`
- Modal shadow: `0 20px 60px rgba(0, 0, 0, 0.3)`

**Button Hover Shadows:**
- Primary (green): `0 6px 20px rgba(33, 150, 83, 0.4)`
- Secondary (blue): `0 6px 20px rgba(102, 126, 234, 0.4)`
- Danger (red): `0 6px 20px rgba(227, 87, 87, 0.4)`
- Warning (orange): `0 6px 20px rgba(242, 153, 74, 0.4)`

---

**Version:** 2.5
**Last Updated:** November 2024
