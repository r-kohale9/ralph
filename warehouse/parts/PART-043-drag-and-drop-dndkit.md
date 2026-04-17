# PART-043: Drag-and-Drop with @dnd-kit/dom

**Category:** CONDITIONAL | **Condition:** Game uses drag-and-drop (Pattern 6 — Pick & Place) | **Dependencies:** PART-021, PART-027, PART-033

> **AUTHORITATIVE for drag-and-drop.** PART-033 Pattern 1 (native HTML5 `draggable="true"` + `dataTransfer`) is SUPERSEDED by this part. Native HTML5 drag does not fire `dragstart`/`drop` on mobile Safari/Chrome — it is banned for every drag game. **Always use `@dnd-kit/dom`** loaded from `https://esm.sh/@dnd-kit/dom@beta`.

---

## Purpose

Provide a cross-device (mouse + touch + pointer) drag-and-drop implementation using the `@dnd-kit/dom` vanilla-JS library. Must satisfy all 8 required behaviours, 3 architectural invariants, and 20 verification-matrix items. Playwright tests will verify V1–V20 programmatically.

---

## Library: @dnd-kit/dom

Load via ESM CDN:

```html
<script type="module">
  import { DragDropManager, Draggable, Droppable } from 'https://esm.sh/@dnd-kit/dom@beta';
  window.__DndKit = { DragDropManager, Draggable, Droppable };
  window.dispatchEvent(new CustomEvent('dndkit:ready'));
</script>
```

Because `<script type="module">` is async, the classes are NOT available at `DOMContentLoaded`. Wait for the `dndkit:ready` event (see R1 below).

**Never use `<div draggable="true">`, `dragstart`/`dragover`/`drop` event listeners, or `e.dataTransfer`. These are native HTML5 drag APIs and are banned — they do not fire on touch devices.**

---

## Architectural Invariants

### R1. ESM async load must not block `waitForPackages`

ESM module loads independently of the CDN packages. DnD setup waits for the `dndkit:ready` event; `waitForPackages` is unchanged.

```javascript
let dndReady = false;
window.addEventListener('dndkit:ready', () => { dndReady = true; });
async function waitForDndKit(timeout = 10000) {
  const start = Date.now();
  while (!dndReady) {
    if (Date.now() - start > timeout) throw new Error('dnd-kit failed to load within 10s');
    await new Promise(r => setTimeout(r, 50));
  }
  return window.__DndKit;
}
```

**Invariant:** Waiting for dnd-kit must NOT be chained behind `waitForPackages`. Run them in parallel (`Promise.all([waitForPackages(), waitForDndKit()])`) if both are needed.
**Failure if violated:** Standalone/Playwright builds hang for 180s; DnD silently does nothing.

### R2. Tag source tracking — never inspect DOM

The library may reparent elements during drag. `dragend` decisions (evict vs swap) must read source location from a game-controlled map, not `parentElement` / `closest()`.

```javascript
// locations: Map<tagId, 'bank' | 'zone-0' | 'zone-1' | ...>
const locations = new Map();
tags.forEach(t => locations.set(t.id, 'bank'));
```

**Invariant:** Update `locations` on every placement, return, swap, eviction.
**Failure if violated:** F1 — every occupied-zone drop evicts to bank; zone-to-zone swap is impossible.

### R3. Per-round lifecycle

Every round replaces the DOM. All DnD instances and tracking state must be destroyed before the new round sets up.

```javascript
let dndManager = null;
let draggables = [];
let droppables = [];

function destroyDndRound() {
  draggables.forEach(d => d.destroy?.());
  droppables.forEach(d => d.destroy?.());
  dndManager?.destroy?.();
  draggables = [];
  droppables = [];
  dndManager = null;
  locations.clear();
}
```

Call `destroyDndRound()` at the start of `loadRound()` and inside `endGame()`.
**Failure if violated:** F2 — DnD stops working after round 2; silent failures.

---

## 8 Required Behaviours

Every P6 game MUST satisfy all 8:

1. **Pick Up & Move Anywhere** — both bank-resident and zone-resident tags are draggable. Attach a `Draggable` instance to every tag regardless of current location.
2. **Exact Cursor Tracking** — the tag stays under the finger at the exact pickup offset, not snapped to centre. Record `(pointerX - rect.left, pointerY - rect.top)` on drag start; apply as overlay offset during move.
3. **Snap to Drop Zones** — on successful drop, `droppable.element.appendChild(source.element)` and let flex centering position it.
4. **Auto-Eviction & Swapping** — in `dragend`, read `locations.get(sourceId)`:
   - `'bank'` → evict: existing occupant returns to its bank slot, source replaces it.
   - `'zone-N'` → swap: existing occupant moves to zone N, source moves to target zone.
5. **Smart Re-Sorting & Bank Re-Centering** — each tag has a dedicated bank placeholder slot. Return = append to that slot. Empty slots get `.slot-collapsed { display: none }` so remaining tags re-centre.
6. **Zone-to-Zone Transfer** — a zone tag dropped into a different empty zone clears the source zone completely (DOM + styling + value state).
7. **Auto Edge-Scrolling** — use dnd-kit's `AutoScroller` plugin if present; otherwise implement manual `requestAnimationFrame` edge scroll with a ~60px threshold from viewport top/bottom.
8. **Universal Touch Support** — works on desktop mouse + mobile touch without page scrolling during drag.

---

## CSS — Touch Rules

```css
/* ONLY the draggable items — never the body, containers, or zones */
.dnd-tag {
  touch-action: none;
  min-width: 44px;
  min-height: 44px;
  user-select: none;
  -webkit-user-select: none;
}

/* Bank slots — each tag has its own placeholder */
.bank-slot { display: flex; align-items: center; justify-content: center; }
.bank-slot.slot-collapsed { display: none; }  /* Collapse when tag moves to zone */

/* Drop zones — flex-centre for snap */
.drop-zone {
  display: flex;
  align-items: center;
  justify-content: center;
  /* touch-action: none  ← FORBIDDEN. Leave zones scrollable. */
}

/* Active drop target highlight */
.drop-zone.dnd-over { background: #EBF0FF; border-color: var(--mathai-blue); }
```

**Forbidden:** `touch-action: none` on `body`, `html`, `#app`, `.bank`, `.drop-zone`, or any scroll container. Putting it anywhere except individual draggables blocks page scroll.

---

## JavaScript — Reference Implementation

```javascript
// Tags: [{ id, value, bankSlotId }], Zones: [{ id, correctValue }]
const zoneValues = new Map();  // zone id → tag id currently in zone (or null)

async function setupDnd(tags, zones) {
  destroyDndRound();
  const { DragDropManager, Draggable, Droppable } = await waitForDndKit();

  dndManager = new DragDropManager();

  // Init tracking
  tags.forEach(t => locations.set(t.id, 'bank'));
  zones.forEach(z => zoneValues.set(z.id, null));

  // One Draggable per tag (attached regardless of current location)
  draggables = tags.map(t => {
    const el = document.getElementById(t.id);
    return new Draggable({ id: t.id, element: el }, dndManager);
  });

  // One Droppable per zone + one for the bank (catches returns)
  droppables = [
    ...zones.map(z => {
      const el = document.getElementById(z.id);
      return new Droppable({
        id: z.id,
        element: el,
        effects() {
          return [() => droppables.find(d => d.id === z.id)?.isDropTarget
            ? el.classList.add('dnd-over')
            : el.classList.remove('dnd-over')];
        }
      }, dndManager);
    }),
    new Droppable({ id: 'bank', element: document.getElementById('bank') }, dndManager),
  ];

  // Prevent page scroll during drag (touch)
  let isDragging = false;
  dndManager.monitor.addEventListener('dragstart', () => { isDragging = true; });
  dndManager.monitor.addEventListener('dragend',   () => { isDragging = false; });
  document.addEventListener('touchmove', (e) => { if (isDragging) e.preventDefault(); }, { passive: false });

  // Drop handling — evict vs swap per R2 / behaviour 4
  dndManager.monitor.addEventListener('dragend', (event) => {
    const { operation, canceled } = event;
    if (canceled) return;
    const sourceId = operation.source.id;
    const targetId = operation.target?.id;
    if (!targetId) { returnToBank(sourceId); return; }
    if (targetId === 'bank') { returnToBank(sourceId); return; }

    const sourceLoc  = locations.get(sourceId);     // 'bank' | 'zone-N'
    const occupantId = zoneValues.get(targetId);    // tag already in target zone, or null

    if (sourceLoc === targetId) return;              // V7 — same zone no-op

    if (!occupantId) {
      moveTagToZone(sourceId, targetId);
      if (sourceLoc !== 'bank') clearZone(sourceLoc);
      return;
    }
    if (sourceLoc === 'bank') {
      // Evict existing → bank, place source
      returnToBank(occupantId);
      moveTagToZone(sourceId, targetId);
    } else {
      // Swap: occupant goes to source's old zone
      moveTagToZone(occupantId, sourceLoc);
      moveTagToZone(sourceId, targetId);
    }
  });

  function moveTagToZone(tagId, zoneId) {
    const tag = document.getElementById(tagId);
    const zone = document.getElementById(zoneId);
    zone.appendChild(tag);
    zone.classList.add('has-tag');
    zoneValues.set(zoneId, tagId);
    locations.set(tagId, zoneId);
    const slot = document.querySelector(`[data-slot-for="${tagId}"]`);
    slot?.classList.add('slot-collapsed');
    updateSubmitButton();
  }

  function clearZone(zoneId) {
    const zone = document.getElementById(zoneId);
    zone.classList.remove('has-tag');
    zoneValues.set(zoneId, null);
    updateSubmitButton();
  }

  function returnToBank(tagId) {
    const tag = document.getElementById(tagId);
    const slot = document.querySelector(`[data-slot-for="${tagId}"]`);
    slot.appendChild(tag);
    slot.classList.remove('slot-collapsed');
    const oldZone = locations.get(tagId);
    if (oldZone && oldZone !== 'bank') clearZone(oldZone);
    locations.set(tagId, 'bank');
    updateSubmitButton();
  }

  function updateSubmitButton() {
    const allFilled = [...zoneValues.values()].every(v => v !== null);
    document.getElementById('btn-check').disabled = !allFilled;
  }
}
```

---

## HTML Skeleton

```html
<!-- Bank with per-tag placeholder slots -->
<div id="bank" class="bank">
  <div class="bank-slot" data-slot-for="tag-0"><div class="dnd-tag" id="tag-0">5</div></div>
  <div class="bank-slot" data-slot-for="tag-1"><div class="dnd-tag" id="tag-1">3</div></div>
  <div class="bank-slot" data-slot-for="tag-2"><div class="dnd-tag" id="tag-2">7</div></div>
</div>

<!-- Drop zones (example: 3 zones for a sort-into-buckets game) -->
<div class="drop-zones">
  <div class="drop-zone" id="zone-0" data-testid="drop-zone-0"></div>
  <div class="drop-zone" id="zone-1" data-testid="drop-zone-1"></div>
  <div class="drop-zone" id="zone-2" data-testid="drop-zone-2"></div>
</div>

<button id="btn-check" data-testid="btn-check" disabled>Check</button>
```

---

## Verification Matrix (V1–V20)

Every P6 game must pass all 20. Tests will verify programmatically.

### Drag operations
| #   | Scenario                     | Precondition                     | Action                    | Expected                                                                                                                                           |
| --- | ---------------------------- | -------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1  | Bank → empty zone            | Tag A in bank, zone 0 empty      | Drop A into zone 0        | Zone 0 contains A; A's bank slot collapsed; `zoneValues[zone-0]=A`; `locations[A]=zone-0`                                                          |
| V2  | Bank → occupied zone (evict) | Tag A in zone 0, tag B in bank   | Drop B into zone 0        | Zone 0 contains B; A back in its bank slot; A's slot visible; `locations[A]=bank`, `locations[B]=zone-0`                                           |
| V3  | Zone → occupied zone (swap)  | Tag A in zone 0, tag B in zone 1 | Drop A into zone 1        | Zone 0 contains B; zone 1 contains A; `locations[A]=zone-1`, `locations[B]=zone-0`; both zones occupied                                            |
| V4  | Zone → empty zone (transfer) | Tag A in zone 0, zone 1 empty    | Drop A into zone 1        | Zone 1 contains A; zone 0 empty (no tag, no `has-tag`, `zoneValues[zone-0]=null`); `locations[A]=zone-1`                                           |
| V5  | Zone → bank (return)         | Tag A in zone 0                  | Drop A on bank            | A in its bank slot; slot visible; zone 0 empty; `zoneValues[zone-0]=null`; `locations[A]=bank`                                                     |
| V6  | Drop outside (cancel)        | Tag A in zone 0                  | Drop A outside any target | A returns to bank slot (same as V5)                                                                                                                |
| V7  | Same zone (no-op)            | Tag A in zone 0                  | Drop A into zone 0        | Zone 0 still contains A, no state change                                                                                                           |

### Bank management
| #   | Condition                       | Expected                                                                |
| --- | ------------------------------- | ----------------------------------------------------------------------- |
| V8  | Tag placed in a zone            | Tag's bank slot has `.slot-collapsed`                                   |
| V9  | Tag returned to bank (any path) | Slot no longer collapsed; tag is a child of its original slot           |
| V10 | Multiple tags placed            | Only their slots collapse; remaining tags re-centre                     |

### State consistency
| #   | Condition                | Expected                                                        |
| --- | ------------------------ | --------------------------------------------------------------- |
| V11 | After any drag operation | `locations` matches actual DOM positions of all tags            |
| V12 | After any drag operation | `zoneValues` matches values displayed in zones                  |
| V13 | All zones filled         | `#btn-check` enabled                                            |
| V14 | Any zone emptied         | `#btn-check` disabled                                           |

### Touch & CSS
| #   | Condition                                    | Expected                                 |
| --- | -------------------------------------------- | ---------------------------------------- |
| V15 | `.dnd-tag` elements                          | Have `touch-action: none`                |
| V16 | `body`, `html`, `#app`, `.bank`, `.drop-zone`| Do NOT have `touch-action: none`         |
| V17 | Every `.dnd-tag`                             | ≥ 44×44 px                                |

### Lifecycle
| #   | Condition                  | Expected                                                                        |
| --- | -------------------------- | ------------------------------------------------------------------------------- |
| V18 | Round transition           | All DnD instances from previous round destroyed before new ones created         |
| V19 | Game end (endGame)         | All DnD instances destroyed                                                     |
| V20 | DnD library not yet loaded | Game still renders; DnD setup defers until `dndkit:ready` fires                 |

---

## Failure Modes (from prior builds)

| # | Bug | Root cause | Prevention |
|---|-----|------------|------------|
| F1 | Zone-to-zone swap always evicts to bank | Used `parentElement` to determine source origin | R2 — read `locations` map, never the DOM |
| F2 | DnD stops working after round 2 | Old instances not destroyed | R3 — `destroyDndRound()` at start of every round |
| F3 | Tags don't work in standalone / Playwright | ESM load chained behind `waitForPackages` 180s wait | R1 — wait in parallel |
| F4 | Evicted tag appears at wrong position in bank | Tag returned to generic container instead of its slot | Per-tag `data-slot-for` placeholders |
| F5 | Bank doesn't re-centre after tag removal | Slot stays visible after placement | `.slot-collapsed { display: none }` on placement |
| F6 | Page scrolls during drag on mobile | `touch-action: none` missing on draggable OR added to body/container | Rule: `touch-action: none` ONLY on `.dnd-tag` |

---

## Verification Checklist

- [ ] `<script type="module">` imports from `https://esm.sh/@dnd-kit/dom@beta` and sets `window.__DndKit`
- [ ] `dndkit:ready` event is dispatched
- [ ] No `draggable="true"` attribute anywhere in the HTML
- [ ] No `dragstart` / `dragover` / `dragleave` / `drop` event listeners
- [ ] No `e.dataTransfer` usage
- [ ] `touch-action: none` on `.dnd-tag` only
- [ ] `touch-action: none` NOT on `body`, `html`, `#app`, `.bank`, `.drop-zone`
- [ ] `locations` Map tracks every tag's current location
- [ ] `zoneValues` Map tracks every zone's current occupant
- [ ] `destroyDndRound()` called at start of `loadRound()` and in `endGame()`
- [ ] Each tag has a dedicated `[data-slot-for="<tagId>"]` bank slot
- [ ] `.slot-collapsed` toggled on placement / removal
- [ ] Submit button enabled only when all zones filled
- [ ] `touchmove` preventDefault gated on `isDragging` flag (not always-on)
- [ ] `waitForDndKit()` runs in parallel with `waitForPackages()`, not chained
