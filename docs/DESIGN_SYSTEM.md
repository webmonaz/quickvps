# Design System

QuickVPS uses a fixed dark theme with a small set of CSS custom properties. Every visual element in the UI is derived from these tokens. **Never hardcode a hex color in HTML or JavaScript** — always reference the variable.

---

## Color Tokens

All tokens are defined in `:root` in `web/css/style.css`.

### Backgrounds

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `#0f1117` | Page background |
| `--bg-card` | `#1a1d27` | Card / header background |
| `--bg-card-hover` | `#1e2130` | Card hover state, tree node hover |

### Borders

| Token | Value | Usage |
|-------|-------|-------|
| `--border` | `#2a2d3e` | All borders, chart grid lines, progress track |

### Text

| Token | Value | Usage |
|-------|-------|-------|
| `--text-primary` | `#e2e8f0` | Body text, values, labels |
| `--text-secondary` | `#8892a4` | Subtitles, legends, table headers |
| `--text-muted` | `#4a5568` | Chart tick labels, expand icons, file icons |

### Accent Colors

| Token | Value | Semantic meaning |
|-------|-------|------------------|
| `--accent-blue` | `#4c9ef5` | Primary action, default fill, interface names, read I/O |
| `--accent-green` | `#3ddc84` | OK state (< 60% usage), network recv, logo accent |
| `--accent-yellow` | `#fbbf24` | Warning state (60–84% usage) |
| `--accent-red` | `#f87171` | Danger state (≥ 85% usage), network sent |
| `--accent-purple` | `#a78bfa` | Write I/O, memory cache |
| `--accent-cyan` | `#22d3ee` | Memory buffers |

---

## Usage Thresholds

Apply these thresholds consistently across **gauges, disk bars, core bars, and tree percentage bars**:

| Range | Color token | CSS class modifier |
|-------|-------------|-------------------|
| 0 – 59% | `--accent-green` | _(default, no class)_ |
| 60 – 84% | `--accent-yellow` | `.warn` |
| ≥ 85% | `--accent-red` | `.danger` |

**JavaScript pattern** (in `app.js` and `ncdu.js`):

```js
function thresholdColor(pct) {
  if (pct < 60) return 'var(--accent-green)';
  if (pct < 85) return 'var(--accent-yellow)';
  return 'var(--accent-red)';
}
```

**CSS pattern** (applied to fill elements):

```css
.disk-bar-fill           { background: var(--accent-blue); }
.disk-bar-fill.warn      { background: var(--accent-yellow); }
.disk-bar-fill.danger    { background: var(--accent-red); }
```

Gauge colors are set dynamically in `gauges.js` `updateGauge()` — the Chart.js dataset color is updated on every tick.

---

## Typography

| Context | Font stack | Size | Weight |
|---------|-----------|------|--------|
| Body text | system-ui (`-apple-system, BlinkMacSystemFont, 'Segoe UI'`) | 14px | 400 |
| Monospace (values, paths, interfaces) | `'JetBrains Mono', 'Fira Code', 'Consolas', monospace` | 12–13px | 400 |
| Card titles | Body stack | 11px | 600, uppercase, letter-spacing 1px |
| Gauge percentage | Mono stack | 28px | 700 |
| Large metric values | Mono stack | 20px | 700 |

The `--font-mono` token must be used for all numeric values, file paths, interface names, and any data that benefits from fixed-width rendering.

---

## Spacing

No spacing token variables exist — use these raw values consistently:

| Purpose | Value |
|---------|-------|
| Page padding | 24px |
| Card padding | 20px |
| Card padding (compact) | 16px |
| Gap between grid cards | 16px |
| Gap between inline items | 6–8px |
| Micro gap | 4px |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | `8px` | Buttons, inputs, small elements |
| `--radius-lg` | `12px` | Cards |

Progress bars and chart fills use `3–4px` radius (hardcoded inline — acceptable for these small decorative elements).

---

## Components

### Card

The base container for all dashboard sections.

```html
<div class="card">
  <div class="card-title">Section Name</div>
  <!-- content -->
</div>
```

- Background: `--bg-card`
- Border: `1px solid var(--border)`
- Border-radius: `var(--radius-lg)`
- Padding: `20px` (standard) or `16px` (compact `.disk-card`)

### Gauge (half-ring)

Chart.js doughnut configured as a half-circle:
- `circumference: 180°` (Math.PI radians)
- `rotation: -90°` (-Math.PI/2 radians)
- `cutout: 75%`
- Canvas wrapper: `160px × 100px`
- The percentage label is absolutely positioned at the bottom-center of the wrapper

Created with `GaugeHelper.createGauge(canvasId)`, updated with `GaugeHelper.updateGauge(chart, pct)`.

### Progress Bar

Used for disk usage, memory breakdown:

```html
<div class="disk-bar">
  <div class="disk-bar-fill [warn|danger]" style="width: X%"></div>
</div>
```

Height: `6px`. Track background: `--border`. Fill uses threshold color classes.

### Rolling Line Chart

60-point window, no animation, `tension: 0.3`, filled area at 15% opacity.

- Y-axis: right-aligned, 4 ticks max, formatted with `ChartHelper.formatBytes`
- X-axis: hidden
- Grid: horizontal only, color `--border`

Created with `ChartHelper.createLineChart(id, datasets, yFormatter)`.
Updated with `ChartHelper.pushData(chart, value1, value2)` — shifts oldest point, pushes new value.

### Collapsible Directory Tree

Rendered by `NcduRenderer.renderNcduTree(container, scanResult)`.

- Top 2 levels rendered and expanded on initial render
- Deeper levels rendered lazily on first expand (click)
- Each row: `expand-icon | type-icon | name | bar | pct% | size`
- Bar width = `entry.dsize / parent.dsize * 100%`
- Bar color follows the same threshold rules (> 50% parent = red, > 20% = yellow, else blue)
- Indent per level: `20px` left margin on `ul.tree-children`

### Button

```html
<button class="btn btn-primary">Label</button>
<button class="btn btn-danger">Cancel</button>
```

- `.btn-primary`: `--accent-blue` background, white text
- `.btn-danger`: transparent background, `--accent-red` border and text
- Disabled state: `opacity: 0.5`, `cursor: not-allowed`

### Status Spinner

```html
<div class="spinner" style="display:none"></div>
```

CSS `border-top-color: var(--accent-blue)` on a circular element, `animation: spin 0.7s linear infinite`.

---

## Layout Grid

Three predefined grid helpers; choose based on content:

| Class | Columns | Usage |
|-------|---------|-------|
| `.grid-3` | 3 equal columns | Top gauges (CPU / Mem / Swap) |
| `.grid-2` | 2 equal columns | Chart pairs (Network / Disk I/O) |
| `.grid-4` | Auto-fill, min 280px | Disk cards |

Breakpoints:
- Below 1200px: `.grid-3` collapses to 2 columns
- Below 768px: all grids collapse to 1 column; `.header-info` is hidden

---

## Animation

- Gauge updates: `duration: 400ms, easing: easeOutQuart` (Chart.js)
- Line chart updates: `animation: false` (real-time data, smoothness via `tension: 0.3`)
- Progress bar width transitions: `transition: width 0.5s ease`
- Connection banner: `slideIn` keyframe (translate + fade, 0.2s)
- Status dot pulse: `opacity` keyframe 2s infinite
- Spinner: `rotate` 0.7s linear infinite

---

## Do's and Don'ts

**Do:**
- Use `var(--token)` for every color
- Use `.warn` and `.danger` classes for threshold-driven color changes
- Use `--font-mono` for all numeric data
- Keep all styles in `style.css`; JavaScript sets `style.width`, `style.height`, and `style.color` only for dynamically computed values

**Don't:**
- Hardcode `#hex` or `rgb()` values in HTML attributes or JavaScript strings (exception: Chart.js dataset colors, which must be valid CSS color strings — use `var()` inside `getComputedStyle` if needed, or reference the hex constants in `gauges.js`)
- Add new CSS classes without a corresponding design token
- Use `!important`
- Add light-mode styles — this tool is dark-only
- Use inline `<style>` blocks in `index.html`
