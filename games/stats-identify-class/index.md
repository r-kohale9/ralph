# Stats Identify Class

**Game ID:** `stats-identify-class`
**Session:** Statistics · Session 2 · **Position:** Game 1 of 3
**Bloom Level:** L1 Remember
**Interaction Type:** central-tendency-identification-mcq

---

## Status

| Field | Value |
|-------|-------|
| **Spec** | Written 2026-03-23 — not yet queued |
| **Approval** | Not built |
| **UI/UX Audit** | Not started |
| **Test Coverage** | Not started |
| **GCP URL** | — |

### Next Action

> Spec written. Before queuing: (1) deploy spec to server (`warehouse/templates/stats-identify-class/spec.md`), (2) create server template directory, (3) local verification of a test build. Do NOT queue speculatively — only queue to verify a specific fix or change.

---

## Game Profile

- **Topic:** Choosing the appropriate measure of central tendency (Mean / Median / Mode) given a real-world data context
- **Grade:** NCERT Class 10, Chapter 14 (Statistics)
- **Rounds:** 10 (fallback) — distribution: 3 Mean (M-none), 3 Median (M1/M3), 4 Mode (M2)
- **Lives:** 3 (life deducted on 2nd wrong attempt or skip)
- **Stars:** 5-tier based on first-attempt accuracy (10→5★, 8-9→4★, 6-7→3★, 4-5→2★, 0-3→0-1★)
- **End states:** Victory (all 10 rounds completed, lives > 0) or Game Over (lives = 0)

## Misconception Coverage

| Tag | Misconception | Rounds |
|-----|---------------|--------|
| M1 | Mean distorted by outlier — should use Median | 2, 7 |
| M2 | Mode required for categorical/frequency/inventory data | 3, 6, 9 |
| M3 | Median for right-skewed numeric distributions | 4, 10 |
| M-none | Mean is correct — symmetric, no outliers | 1, 5, 8 |

## Session Progression

- **Predecessor:** None (first game in statistics sequence)
- **Successor:** `stats-compute-measure` (Bloom L2 Apply — compute the measure, planned)
- **Third:** `stats-interpret-result` (Bloom L3 Analyze — interpret mean vs median difference, planned)

## Research Sources

1. NCERT Class 10 Chapter 14 Statistics — exercise contexts (factory wages, plant counts, grouped data)
   https://www.learncbse.in/ncert-solutions-for-class-10-maths-chapter-14-statistics/
2. Cooper & Shore (2008) — student misconceptions in central tendency identification
   https://www.tandfonline.com/doi/full/10.1080/10691898.2008.11889559
3. Accounting Insights (2024) — when to use mean vs median vs mode
   https://accountinginsights.org/choosing-the-right-central-tendency-measure-for-data-analysis/

---

## Build History

| Build # | Date | Status | Iterations | Outcome | Notes |
|---------|------|--------|------------|---------|-------|
| — | — | — | — | — | Spec written; awaiting first build |
