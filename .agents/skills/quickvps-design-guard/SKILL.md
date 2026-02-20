---
name: quickvps-design-guard
description: Run fast static checks for high-impact QuickVPS frontend convention violations (Zustand wide selectors, hardcoded hex in TSX, and realtime chart state anti-patterns). Use when reviewing frontend edits or before merge.
---

# QuickVPS Design Guard

Run quick static checks focused on performance-sensitive UI conventions.

## Run

From repository root:

```bash
bash skills/quickvps-design-guard/scripts/design_guard.sh
```

## Rules

1. Flag direct `useStore((s) => s.snapshot)` subscriptions.
2. Flag hardcoded hex values in `.tsx` files as review warnings.
3. Flag likely realtime-chart state anti-patterns (`useState` for datasets/history/chart data).
4. Remind required pattern: narrow selectors + `useRef` Chart.js instances + imperative updates.

## Output contract

- Print violations with file and line numbers.
- Exit code `1` for rule (1) or (3) violations.
- Keep hex findings as warnings (do not fail by themselves).
