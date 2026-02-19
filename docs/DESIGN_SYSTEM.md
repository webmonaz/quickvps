# Design System

QuickVPS uses a fixed dark theme. All design tokens are expressed as **Tailwind CSS utility classes** referencing custom colors defined in `frontend/tailwind.config.ts`. Never hardcode a hex color in JSX or inline styles — always use the token class or `getThresholdHex()` from `src/lib/thresholdColor.ts`.

---

## Color Tokens

Defined in `frontend/tailwind.config.ts` under `theme.extend.colors` and mirrored as CSS custom properties in `frontend/src/index.css` via Tailwind's base layer.

### Backgrounds

| Tailwind class | Hex | Usage |
|----------------|-----|-------|
| `bg-bg-primary` | `#0f1117` | Page background |
| `bg-bg-card` | `#1a1d27` | Card / header background |
| `bg-bg-card-hover` | `#1e2130` | Card hover, tree node hover |

### Borders

| Tailwind class | Hex | Usage |
|----------------|-----|-------|
| `border-border-base` | `#2a2d3e` | All borders, chart grid lines, progress track |

### Text

| Tailwind class | Hex | Usage |
|----------------|-----|-------|
| `text-text-primary` | `#e2e8f0` | Body text, values, labels |
| `text-text-secondary` | `#8892a4` | Subtitles, legends, table headers |
| `text-text-muted` | `#4a5568` | Chart tick labels, expand icons |

### Accent Colors

| Tailwind class | Hex | Semantic meaning |
|----------------|-----|------------------|
| `text-accent-blue` / `bg-accent-blue` | `#4c9ef5` | Primary action, default fill, interface names, read I/O |
| `text-accent-green` / `bg-accent-green` | `#3ddc84` | OK state (< 60% usage), network recv, logo accent |
| `text-accent-yellow` / `bg-accent-yellow` | `#fbbf24` | Warning state (60–84% usage) |
| `text-accent-red` / `bg-accent-red` | `#f87171` | Danger state (≥ 85% usage), network sent |
| `text-accent-purple` / `bg-accent-purple` | `#a78bfa` | Write I/O, memory cache |
| `text-accent-cyan` / `bg-accent-cyan` | `#22d3ee` | Memory buffers |

---

## Usage Thresholds

Apply these thresholds consistently across **gauges, disk bars, core bars, and tree percentage bars**.

| Range | Tailwind class | Hex |
|-------|----------------|-----|
| 0 – 59% | `text-accent-green` | `#3ddc84` |
| 60 – 84% | `text-accent-yellow` | `#fbbf24` |
| ≥ 85% | `text-accent-red` | `#f87171` |

**TypeScript helpers** (`src/lib/thresholdColor.ts`):

```typescript
// Returns a Tailwind text-color class
getThresholdColor(pct: number): string

// Returns a hex string (for Chart.js dataset colors)
getThresholdHex(pct: number): string

// Returns a Tailwind bg-color class (for progress bars)
getThresholdBgColor(pct: number): string
```

Constants are in `src/constants/thresholds.ts`:

```typescript
export const THRESHOLD_WARN   = 60
export const THRESHOLD_DANGER = 85
```

---

## Typography

| Context | Classes | Notes |
|---------|---------|-------|
| Body text | _(Tailwind default)_ | System UI, 14px, 400 |
| Monospace values / paths | `font-mono text-xs` | JetBrains Mono stack |
| Card titles | `text-xs font-semibold uppercase tracking-wider text-text-secondary` | Via `CardTitle` component |
| Gauge percentage | `text-2xl font-bold font-mono` | Inside `HalfGauge` wrapper |

The `font-mono` class maps to `'JetBrains Mono', 'Fira Code', 'Consolas', monospace` (defined in `tailwind.config.ts`).

---

## Spacing

Tailwind's default scale is used throughout. Key values:

| Purpose | Tailwind |
|---------|----------|
| Page padding | `p-4` (16px) |
| Card padding | `p-4` (16px) |
| Grid gap | `gap-4` (16px) |
| Inline item gap | `gap-2` – `gap-3` (8–12px) |

---

## Border Radius

| Tailwind class | Value | Usage |
|----------------|-------|-------|
| `rounded-card` | `12px` | Cards |
| `rounded-base` | `8px` | Buttons, inputs |
| `rounded-full` | 9999px | Progress bars, status dot, spinner |

---

## Components

### Card

Base container. Use the `Card` component (`src/components/ui/Card.tsx`):

```tsx
<Card className="optional-extra-classes">
  <CardTitle>Section Name</CardTitle>
  {/* content */}
</Card>
```

- Background: `bg-bg-card`
- Border: `border border-border-base`
- Radius: `rounded-card`
- Padding: `p-4`

### HalfGauge

Chart.js doughnut configured as a half-circle. Use `HalfGauge` (`src/components/charts/HalfGauge.tsx`):

```tsx
<HalfGauge percent={cpuPct} />
```

Config:
- `circumference: 180`, `rotation: -90`
- `cutout: '75%'`
- `animation: { duration: 400, easing: 'easeOutQuart' }`
- Chart instance lives in `useRef` — no React re-render on update, only imperative `chart.update('none')`

### ProgressBar

Threshold-color-aware horizontal bar. Use `ProgressBar` (`src/components/ui/ProgressBar.tsx`):

```tsx
<ProgressBar percent={diskPct} />
```

Height: `h-1.5` (6px). Track: `bg-border-base`. Fill color from `getThresholdHex()`.

### RollingLineChart

60-point window, no animation. Use `RollingLineChart` (`src/components/charts/RollingLineChart.tsx`):

```tsx
<RollingLineChart
  datasets={[
    { label: 'Recv', color: '#3ddc84', data: recvHistory },
    { label: 'Sent', color: '#f87171', data: sentHistory },
  ]}
/>
```

Chart instance in `useRef`. Y-axis: 4 ticks, bytes/s format. X-axis: hidden.

### Button

```tsx
<Button variant="primary" onClick={handleScan}>Scan</Button>
<Button variant="danger"  onClick={handleCancel}>Cancel</Button>
<Button variant="ghost"   onClick={handleClose}>Close</Button>
```

Variants in `src/components/ui/Button.tsx`. Disabled state via HTML `disabled` prop.

### Toast

Use the shared toast system for transient/global feedback instead of ad-hoc banners.

- UI component host: `src/components/ui/Toast.tsx` (`Toast`, `ToastHost`)
- Hook API: `src/hooks/useToast.ts`
- State/actions: `src/store/index.ts` (`showToast`, `removeToast`)

```tsx
const { showSuccess, showError, showPersistent } = useToast()

showSuccess('Saved settings')
showError('Failed to update interval')
showPersistent('info', 'Background job is running')
```

Behavior:
- `info` and `success` toasts auto-dismiss after **3 seconds** by default.
- `error` toasts auto-dismiss after **15 seconds** by default.
- Persistent toasts are supported via `showPersistent(...)` or by setting `autoCloseMs: null`.
- All toasts are manually dismissible via the close button.

### NcduTree / NcduTreeNode

Collapsible directory tree. `NcduTreeNode` lazy-renders children on first expand:

```typescript
const [isExpanded,  setIsExpanded]  = useState(depth < 2)
const [hasRendered, setHasRendered] = useState(depth < 2)
// Children only mounted when hasRendered=true
```

Bar color rules (based on `entry.dsize / parent.dsize`):
- > 50% → `#f87171` (red)
- > 20% → `#fbbf24` (yellow)
- else → `#4c9ef5` (blue)

---

## Layout Grid

Tailwind responsive grid classes. All grids collapse to 1 column on mobile (`sm:` breakpoint at 640px).

| Section | Classes |
|---------|---------|
| Gauges (CPU / Mem / Swap) | `grid grid-cols-1 sm:grid-cols-3 gap-4` |
| Charts (Network / Disk I/O) | `grid grid-cols-1 sm:grid-cols-2 gap-4` |
| Disk cards | `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3` |

---

## Animation

| Element | Behavior |
|---------|----------|
| Gauge update | Chart.js `duration: 400ms, easing: easeOutQuart` |
| Line chart update | `animation: false` (real-time data) |
| Progress bar | Tailwind `transition-[width] duration-300` |
| Status dot (connected) | `shadow-[0_0_6px_#3ddc84]` glow |
| Spinner | Tailwind `animate-spin` |

---

## Do's and Don'ts

**Do:**
- Use Tailwind token classes (`text-accent-green`, `bg-bg-card`, etc.) for every color
- Use `getThresholdHex(pct)` for Chart.js dataset colors (which require hex strings)
- Use `font-mono` for all numeric data, file paths, interface names
- Keep all components in `src/components/` and follow `React.memo` strategy from `CLAUDE.md`
- Use narrow Zustand selectors to avoid re-renders on every 2 s WS push

**Don't:**
- Hardcode `#hex` or `rgb()` values in JSX or inline styles
- Access `useStore(s => s.snapshot)` directly (subscribes to the whole snapshot — re-renders every 2 s)
- Use `useState` for Chart.js data — use `useRef` + imperative update
- Add light-mode styles — this tool is dark-only in Phase 1
- Add npm packages without updating `CLAUDE.md` and `README.md`
