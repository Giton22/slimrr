# Frontend Improvements Plan: Phase 5 (Design Polish) & Phase 6 (Performance)

## Phase 5: Design Polish

### 5.1 Define Semantic Color Tokens for Success/Warning

**Problem:** 7 hardcoded Tailwind color classes (`text-green-600`, `text-red-500`, `bg-green-500/10`, `text-amber-500`) scattered across 4 files represent semantic meanings (success, danger, warning) but bypass the theme system.

**Solution:** Add semantic `--success` and `--warning` CSS variables to `src/assets/index.css`, and map them in `@theme inline`:

```css
:root {
  /* existing vars... */
  --success: oklch(0.55 0.16 145);
  --success-foreground: oklch(0.98 0 0);
  --warning: oklch(0.75 0.18 75);
}

.dark {
  --success: oklch(0.70 0.17 155);
  --success-foreground: oklch(0.15 0 0);
  --warning: oklch(0.80 0.15 80);
}
```

In `@theme inline`:
```css
--color-success: var(--success);
--color-success-foreground: var(--success-foreground);
--color-warning: var(--warning);
```

**Files to update:**
| File | Line(s) | Change |
|------|---------|--------|
| `StatCard.vue` | 27 | `text-green-600 dark:text-green-400` → `text-success` |
| `StatCard.vue` | 27 | `text-red-600 dark:text-red-400` → `text-destructive` |
| `SettingsView.vue` | 358 | `text-green-600` → `text-success` |
| `SettingsView.vue` | 453 | `bg-green-500/10 text-green-700 dark:text-green-400` → `bg-success/10 text-success` |
| `SettingsView.vue` | 463 | `text-green-600` → `text-success` |
| `SetupView.vue` | 361-362 | `bg-green-500/10 text-green-600` → `bg-success/10 text-success` |
| `LogWeightDialog.vue` | 104 | `text-amber-500` → `text-warning` |

**Note:** BMI category colors in `useBmi.ts` are intentionally hardcoded (WHO standard colors) and should NOT be converted.

---

### 5.2 Remove Duplicate SetKcalGoalDialog in KcalSection

**Problem:** `KcalSection.vue` renders `SetKcalGoalDialog` twice -- once in the chart card header (line 50) and once in the daily calories table card header (line 63).

**Solution:** Remove the duplicate from the table card header. Keep it only in the chart card header where it's alongside the other action buttons.

---

### 5.3 Improve Mobile Stat Card Layout

**Problem:** WeightSection renders 7 cards (1 QuickLog + 6 StatCards) stacking vertically on mobile. Users scroll ~700px before seeing the chart.

**Solution:** Use a 2-column grid on mobile for the stat cards (not QuickLogWeight, which is wider):

```html
<!-- QuickLogWeight stays full-width -->
<QuickLogWeight />

<!-- Stat cards in compact 2-col grid even on mobile -->
<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
  <StatCard ... />
  <StatCard ... />
  ...
</div>
```

This cuts vertical scrolling roughly in half on mobile.

---

### 5.4 Add Subtle Hover State to RecentEntries Rows

**Problem:** RecentEntries table rows have no visual hover feedback, making it harder to scan data.

**Solution:** Add `hover:bg-muted/50 transition-colors` to each `<TableRow>`.

---

### 5.5 Standardize Page Layout Padding

**Problem:** Views use different vertical padding (`py-6`, `py-8`) and the NotFoundView has none.

**Solution:**
- Standardize content views to `py-6 sm:py-8` (small padding on mobile, standard on desktop)
- Add `py-6` to NotFoundView
- Auth/Setup are intentionally different (full-screen centered) -- leave as-is

---

## Phase 6: Performance

### 6.1 Extract Inline Chart Object Literals

**Problem:** `WeightChart.vue` and `KcalChart.vue` pass inline object/array literals as props (`:margin="{ ... }"`, `:y="[yConsumed]"`), creating new references on every render.

**Solution:** Extract as `const` in `<script setup>`:
```ts
const chartMargin = { top: 10, right: 10, bottom: 30, left: 45 }
```
Then use `:margin="chartMargin"`.

Files: `WeightChart.vue`, `KcalChart.vue` (5 inline literals total)

---

### 6.2 Create Reactive `today` Ref That Updates at Midnight

**Problem:** 6 computed properties in `stores/weight.ts` and 1 in `QuickLogWeight.vue` call `todayISO()` which is not reactive. If the app stays open overnight, these go stale.

**Solution:** Create `src/composables/useToday.ts`:
```ts
import { ref, onUnmounted } from 'vue'
import { todayISO } from '@/lib/date'

const today = ref(todayISO())
let timerCount = 0
let intervalId: ReturnType<typeof setInterval> | null = null

function startTimer() {
  if (intervalId) return
  intervalId = setInterval(() => {
    const now = todayISO()
    if (today.value !== now) today.value = now
  }, 60_000) // check every minute
}

function stopTimer() {
  if (intervalId && timerCount <= 0) {
    clearInterval(intervalId)
    intervalId = null
  }
}

export function useToday() {
  timerCount++
  startTimer()
  onUnmounted(() => {
    timerCount--
    if (timerCount <= 0) stopTimer()
  })
  return today
}

// For stores (no lifecycle hooks available)
export { today }
```

Then in the weight store, import the singleton `today` ref and use it in computed properties instead of calling `todayISO()`. Since the store doesn't have component lifecycle, the timer is started when any component calls `useToday()` (e.g., App.vue).

**Files to update:**
- `App.vue` -- call `useToday()` once to start the timer
- `stores/weight.ts` -- replace `todayISO()` with `today.value` in 5 computed properties
- `QuickLogWeight.vue` -- replace `todayISO()` in the `todayEntry` computed with `today.value`

---

### 6.3 Remove Unused `@tanstack/vue-table` Dependency + Dead Utils

**Problem:** `@tanstack/vue-table` is in `package.json` dependencies but `src/components/ui/table/utils.ts` (its only consumer) is never imported.

**Solution:**
- Delete `src/components/ui/table/utils.ts`
- Run `bun remove @tanstack/vue-table`

---

### 6.4 Limit Initial Data Load (Bounded Fetch)

**Problem:** `getFullList()` in `weight.ts:112-113` fetches ALL weight and calorie entries. A user with 3+ years of daily data would load 1000+ records into memory on startup.

**Solution:** Limit the initial load to the last 365 days (covers all reasonable chart ranges), and only fetch older data on demand:

```ts
const oneYearAgo = cutoffISO(365)

const [weightRecords, calorieRecords, ...] = await Promise.all([
  pb.collection(COLLECTIONS.WEIGHT_ENTRIES).getFullList({
    filter: pb.filter('user = {:userId} && date >= {:cutoff}', { userId, cutoff: oneYearAgo }),
    sort: 'date',
  }),
  pb.collection(COLLECTIONS.CALORIE_ENTRIES).getFullList({
    filter: pb.filter('user = {:userId} && date >= {:cutoff}', { userId, cutoff: oneYearAgo }),
    sort: 'date',
  }),
  // kcal_goal_history and user_settings remain unbounded (tiny datasets)
])
```

**Trade-off:** Users won't see data older than 1 year in charts. The time range selector already only goes up to 90 days, so 365 days provides generous headroom. Settings like "current weight" use `latestEntry` which comes from sorted entries (still correct since we fetch recent data).

**Edge case:** The store's `currentWeight` depends on the latest entry. If a user hasn't logged in a year, this would be null. Acceptable -- they'd need to log a new entry anyway.

---

## Summary

### Phase 5 Changes (Design Polish)

| # | Task | Files | Impact |
|---|------|-------|--------|
| 5.1 | Add semantic success/warning color tokens | `index.css` + 4 consumers | Theme-consistent colors, dark mode automatic |
| 5.2 | Remove duplicate SetKcalGoalDialog | `KcalSection.vue` | Less confusing UI |
| 5.3 | 2-column stat card grid on mobile | `WeightSection.vue` | ~50% less scrolling to reach chart |
| 5.4 | Add hover state to RecentEntries rows | `RecentEntries.vue` | Better table scannability |
| 5.5 | Standardize page layout padding | 2 view files | Visual consistency |

### Phase 6 Changes (Performance)

| # | Task | Files | Impact |
|---|------|-------|--------|
| 6.1 | Extract inline chart object literals | `WeightChart.vue`, `KcalChart.vue` | Prevent unnecessary re-renders |
| 6.2 | Reactive `today` ref for midnight rollover | 1 new composable + 3 consumers | 6 computed properties stay fresh |
| 6.3 | Remove unused @tanstack/vue-table + dead utils | `package.json`, 1 deleted file | Smaller install, cleaner deps |
| 6.4 | Bound initial data load to 365 days | `stores/weight.ts` | Faster startup, less memory for heavy users |

### New files: 1 (`src/composables/useToday.ts`)
### Deleted files: 1 (`src/components/ui/table/utils.ts`)
### Total files modified: ~12
### Dependencies removed: 1 (`@tanstack/vue-table`)
