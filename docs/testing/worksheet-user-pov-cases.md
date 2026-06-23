# Worksheet — User-POV (Screen-by-Screen) Test Cases

Everything a **user/tester actually sees and does**, organized **by screen**. No code knowledge
needed — open a worksheet, walk the screens in order, and tick each case from the UI, sounds, and
what happens when you tap. Use it to confirm a worksheet *feels* 100% working.

> Companion to the engineering matrix in `worksheet-test-plan.md` (which covers the under-the-hood
> plumbing a user can't see). This file is purely the player's view.

**Flow:** `Entry → Levels → Landing → Countdown → Story → Gameplay (loops per question) → Medal → Leaderboard → End`

*Countdown = Native only · Leaderboard = some worksheets only · Story can also recur between questions. **Plat** column: Both / Native (slug URL, has countdown) / Legacy (numeric URL, embedded player). **No audio controls anywhere** — no replay, mute, or sound toggle (don't test for them); audio still pauses on tab/app switch.*

---

## SCREEN 1 — App entry / loading
**→ Open the link → I land in the worksheet already signed in; while it loads I see a loader, never a blank screen.**

| ID | Plat | Check | Expected |
| --- | --- | --- | --- |
| ENTRY-01 | Both | Open the link with my mobile in the URL | I land in the worksheet/levels **already signed in as me** — no login wall |
| ENTRY-02 | Both | Open a link whose number isn't recognized | I'm sent to sign-in/profile — **not** a blank or broken page |
| ENTRY-03 | Both | Open on a slow connection | A **loading shimmer/spinner** shows; never a white screen or frozen blank |
| ENTRY-04 | Both | Deep-link straight into a level | It loads on its own, without needing a prior screen |

---

## SCREEN 2 — Levels page (worksheet overview)
**→ All the levels for this worksheet are shown; tapping one opens its landing page with "Start now".**

| ID | Plat | Check | Expected |
| --- | --- | --- | --- |
| LEVELS-01 | Both | The page loads | I see the **list/grid of levels** for this worksheet, each with a title |
| LEVELS-02 | Both | Each level's state | Completed levels show earned ⭐/medal; the current level is marked; locked levels look locked |
| LEVELS-03 | Both | Tap an available level | Opens that level's **landing page** ("Start now!") |
| LEVELS-04 | Both | Tap a **locked** level | It doesn't open (or shows why it's locked) — no dead-end / crash |
| LEVELS-05 | Both | My overall progress | Stars/levels-done summary is shown and **matches my real progress** |
| LEVELS-06 | Both | Tap **back** from the levels page | Returns to where I came from (home/chat), cleanly |
| LEVELS-07 | Both | Many levels | I can **scroll** the list smoothly |

> If you deep-linked straight to a level, this screen may be skipped — go to SCREEN 3.

---

## SCREEN 3 — Level landing page
**→ Title, art, "stars I can earn", and a Start now button; tapping Start begins the level. (No audio plays here.)**

| ID | Plat | Check | Expected |
| --- | --- | --- | --- |
| LANDING-01 | Both | The page contents | I see the **level title**, banner/illustration, **stars I can earn** (e.g. "0/6"), and a clear **"Start now!"** button |
| LANDING-02 | Both | Stars/progress shown | **Match my real state** — 0 if fresh, partial if I'm resuming |
| LANDING-03 | Both | Tap **Start now!** | Native → **countdown**; Legacy → **first question**. No dead tap |
| LANDING-04 | Both | Tap **back** here | Returns to the levels page / prior screen |
| LANDING-05 | Both | How-to / instructions | If present, readable and matches this game |

---

## SCREEN 4 — Countdown (Native)
**→ After Start, a 3-2-1-GO animation plays with its countdown sound, then gameplay begins. (This countdown sound is the one place audio kicks in.)**

| ID | Plat | Check | Expected |
| --- | --- | --- | --- |
| COUNTDOWN-01 | Native | After tapping Start | A **3-2-1-GO** countdown animation shows |
| COUNTDOWN-02 | Native | Countdown audio | The **count-down sound plays** during the animation |
| COUNTDOWN-03 | Native | After "GO" | Gameplay begins **smoothly** (no stall/flash) |
| COUNTDOWN-04 | Native | Countdown sound fails to load | It **still counts down and starts** — no stall |
| COUNTDOWN-05 | Native | Back during the countdown | Handled sensibly (no app exit/blank) |

---

## SCREEN 5 — Story component (start of a block / between questions)
**→ The story component shows narrative/teaching content. It can appear at the start of a block (before the first question) and between questions during the block.**

| ID | Plat | Check | Expected |
| --- | --- | --- | --- |
| STORY-01 | Both | At the **start of a block** | A story/teaching segment can play before the first question (narrative/teaching content) |
| STORY-02 | Both | **Between questions** | A story can also appear mid-block as an interstitial |
| STORY-03 | Both | Story content | Plays as designed (text/animation/audio); it is **not graded** (no ⭐/heart effect) |
| STORY-04 | Both | Getting through it | I can continue (Continue button or auto) and it advances to the next question / gameplay |
| STORY-05 | Both | Back during a story | Handled sensibly (exit popup or returns to where I was) |
| STORY-06 | Both | Switch away during a story | Pauses and resumes like gameplay (see 6h) — nothing skipped |
| STORY-07 | Both | No story configured | The worksheet flows straight into the questions — no empty story screen |

---

## SCREEN 6 — Gameplay screen
**→ I read the prompt, answer, Submit, and get correct/incorrect feedback; the back button (in-app & native) shows an "exit?" popup; switching tab/app pauses the game and prompts me to resume.**

### 6a. What's on screen
| ID | Plat | Check | Expected |
| --- | --- | --- | --- |
| GAMEPLAY-01 | Both | Header & prompt | I can see the **question prompt** (text/image), the **question/round number** ("Q1", "1/3"), and my **running ⭐ score** |
| GAMEPLAY-02 | Both | Hearts — multi-life question | If the question has **more than one life**, a heart indicator shows how many I have left (count matches the question's config) and drops by one on each wrong answer |
| GAMEPLAY-02b | Both | Hearts — single-life question | If the question has **only one life**, **no heart icon appears in the header bar** |
| GAMEPLAY-02c | Both | Heart placement | The heart indicator shows either **in the header bar**, or — for **round-based questions** — as a **row of hearts** within the question not both |
| GAMEPLAY-03 | Both | Primary button | A clear action button (e.g. **"Submit & check"**) is present |
| GAMEPLAY-05 | Both | Timer | If the question is timed, a **timer is visible and counting** |

### 6b. Audio
| ID | Plat | Check | Expected |
| --- | --- | --- | --- |
| GAMEPLAY-06 | Both | Question audio | If the question has audio, it **plays on load** (no replay button exists — don't test for one) |
| GAMEPLAY-07 | Both | Result audio | If the question plays result audio, ✓ and ✗ **sound different** |

### 6c. Answering
| ID | Plat | Check | Expected |
| --- | --- | --- | --- |
| GAMEPLAY-08 | Both | Interact with the input | My action **visibly registers** — option highlights / typed value shows / cell changes / item drops in |
| GAMEPLAY-09 | Both | Change my mind | I can **change my answer before submitting**; after submit it **locks** |
| GAMEPLAY-10 | Both | Multiple-choice input | Tap an option → it highlights as selected |
| GAMEPLAY-11 | Both | Typed/number input | A keypad opens; I can type, edit, clear |
| GAMEPLAY-12 | Both | Tap-grid / board input | Tapping a cell **cycles** its state (empty → mark → answer → empty); I can place/clear freely |
| GAMEPLAY-13 | Both | Drag-and-drop input | I can drag an item into a slot and back out |
| GAMEPLAY-14 | Both | Voice/explain input | I can speak/record, or there's a **text fallback** if I deny the mic |

### 6d. Submit & feedback
> **Feedback style varies question-to-question and worksheet-to-worksheet** — it may be color, animation,
> sound, a sticker, text, or a mix. Don't assert a *specific* form; assert that **appropriate
> correct-vs-incorrect feedback appears** and the score/hearts update accordingly.

| ID | Plat | Check | Expected |
| --- | --- | --- | --- |
| GAMEPLAY-15 | Both | Submit a **correct** answer | I get clear **positive feedback** (form depends on the question), a **⭐ is awarded**, and my score goes up |
| GAMEPLAY-16 | Both | Submit a **wrong** answer | I get clear **negative feedback** (form depends on the question); if the question uses lives, **one heart is lost** |
| GAMEPLAY-17 | Both | While it's checking | A brief **evaluating** state; I can't change my answer mid-check |
| GAMEPLAY-18 | Both | Submit with **nothing** entered | Nothing happens — **no false ✓, no wasted heart** |
| GAMEPLAY-19 | Both | **Double-tap** submit | Submits **once** — no double-count |

### 6e. Retry & running out of hearts
| ID | Plat | Check | Expected |
| --- | --- | --- | --- |
| GAMEPLAY-20 | Both | After a wrong answer (hearts left) | Button becomes **"Try again!"**; tapping it **clears my input** so I can re-answer the same question |
| GAMEPLAY-21 | Both | On retry | My **prior hearts/score are preserved** (retry doesn't reset the whole game) |
| GAMEPLAY-22 | Both | Retry vs first-try ⭐ | A retried answer earns **≤** the stars of a first-try correct (never more) |
| GAMEPLAY-23 | Both | Keep answering wrong | When hearts hit 0, the **last wrong answer moves on** to the next question — no forever-retry trap |
| GAMEPLAY-24 | Both | Hearts exhausted | The **correct answer may be revealed** before moving on |
| GAMEPLAY-25 | Both | First-try correct | Costs **no hearts** |

### 6f. Hint / timer / rounds
| ID | Plat | Check | Expected |
| --- | --- | --- | --- |
| GAMEPLAY-26 | Both | "Check now"-style help (if offered) | Shows feedback on my **current** answer **without** ending the question |
| GAMEPLAY-27 | Both | Timer reaches 0 | My answer **auto-submits** |
| GAMEPLAY-28 | Both | Multi-round question | Round progress shows (1/3 → 3/3); finishes **only after the last round** |
| GAMEPLAY-29 | Both | Streak/combo (if any) | Builds on consecutive ✓; resets after a miss |

### 6g. Back / exit (the back button behavior)
| ID | Plat | Check | Expected |
| --- | --- | --- | --- |
| GAMEPLAY-30 | Both | Tap the **in-app back** button during gameplay | An **"exit / quit?" confirmation popup** appears (so I don't lose progress by accident) |
| GAMEPLAY-31 | Native | Press the **hardware/gesture back** during gameplay | The **same exit popup** appears — the app does **not** quit or go blank |
| GAMEPLAY-32 | Both | Popup → **Cancel/Stay** | I return to the question exactly where I was |
| GAMEPLAY-33 | Both | Popup → **Confirm/Quit** | I leave to the right place (levels/home); my progress is handled per design (saved or discarded, not corrupted) |

### 6h. Pause / resume (tab switch / app switch)
| ID | Plat | Check | Expected |
| --- | --- | --- | --- |
| GAMEPLAY-34 | Both | Switch browser tab / background the app mid-question | The worksheet **pauses** — any audio **pauses** and the timer **stops counting**; gameplay freezes (no time/lives lost while away) |
| GAMEPLAY-35 | Both | Come back to the worksheet | A **resume popup** appears prompting me to continue |
| GAMEPLAY-36 | Both | Tap **Resume** | Play continues **exactly where I left off** — timer/audio resume, my answer-in-progress and hearts/score are intact |
| GAMEPLAY-37 | Both | Stay away a long while | Inactive time isn't counted against me; I may also get a gentle **"still there?"** nudge |
| GAMEPLAY-38 | Native | Phone lock / incoming call mid-question | Same pause behavior; resume popup on return; no corruption |

### 6i. Transitions & resilience
| ID | Plat | Check | Expected |
| --- | --- | --- | --- |
| GAMEPLAY-39 | Both | Next question loads | **Smoothly** (no full reload/flash); the header score/round updates |
| GAMEPLAY-40 | Both | No bleed-through | No leftover from the previous question (old input/audio doesn't carry over) |
| GAMEPLAY-41 | Both | Broken image/sound asset | Placeholder / stays quiet — the game **keeps working** |
| GAMEPLAY-42 | Both | Spam taps (options/submit) | Never double-advances or corrupts my score |
| GAMEPLAY-43 | Both | Rotate / resize | Layout stays usable — nothing clipped or under the notch/home bar |

---

## SCREEN 7 — Medal / results
**→ Medal audio plays; the medal tier and the stars earned all match my actual gameplay.**

| ID | Plat | Check | Expected |
| --- | --- | --- | --- |
| MEDAL-01 | Both | The screen | Shows a **medal** (gold/silver/bronze), **stars earned (x/y)**, points, and time/speed |
| MEDAL-02 | Both | **Medal audio** | A celebration **voice-over/sound plays** (and uses **my name** if it greets me) |
| MEDAL-03 | Both | **Stars align with gameplay** | The stars shown here **equal what I actually earned** across the questions |
| MEDAL-04 | Both | Points & time | Consistent with the run (no mismatched/zeroed values) |
| MEDAL-05 | Both | Tier matches performance | A great run → **gold**; a rough run → a **lower tier** (better play never shows a worse medal) |
| MEDAL-06 | Both | Medal audio missing | Screen **still renders**; nothing blocks |
| MEDAL-07 | Both | Continue button | A clear **"Continue"/"Next"** is present |
| MEDAL-08 | Both | Back on this screen | Doesn't drop me back into the finished level or double-count |

---

## SCREEN 8 — Leaderboard (only some worksheets)
**→ Leaderboard is optional — it only appears for worksheets that have one. When it does: my row is highlighted with the points I just earned; tabs (Daily/Weekly/Monthly/Lifetime) reorder the list; it opens on Daily and shows all regions.**

| ID | Plat | Check | Expected |
| --- | --- | --- | --- |
| LEADERBOARD-01 | Both | Worksheet **has** a leaderboard | A **leaderboard** appears after the medal |
| LEADERBOARD-02 | Both | Worksheet has **no** leaderboard | It's **skipped** — I go straight to the finish; no empty/broken board |
| LEADERBOARD-03 | Both | My entry | **My row is highlighted** with my name/avatar, **rank**, and **points** |
| LEADERBOARD-04 | Both | My points | **Reflect what I just earned** this run |
| LEADERBOARD-05 | Both | Other players | Ranked **best-to-worst** (rank 1 on top) |
| LEADERBOARD-06 | Both | Tabs | **Daily / Weekly / Monthly / Lifetime** are present; tapping each **reorders** the list |
| LEADERBOARD-07 | Both | Default tab | It opens on the **Daily** tab |
| LEADERBOARD-08 | Both | Scope | The board shows players **across regions** (not filtered to just mine) |
| LEADERBOARD-09 | Both | Find myself | I can **scroll** to my position if I'm not near the top |
| LEADERBOARD-10 | Both | Board fails to load | A **tidy empty/retry** state — not a crash |
| LEADERBOARD-11 | Both | Continue | A clear way to **move on** from the leaderboard |

---

## SCREEN 9 — End → report / next
**→ Continue takes me onward, not back into the finished level; refresh mid-worksheet resumes where I was.**

| ID | Plat | Check | Expected |
| --- | --- | --- | --- |
| END-01 | Both | Tap **Continue** at the end | I land on the **report/chat or next activity** — **not** back inside the finished level |
| END-02 | Both | The report/next screen | Shows the completed worksheet context |
| END-03 | Both | Refresh / return **mid-worksheet** | I **resume where I was** (not forced back to question 1) |
| END-04 | Both | Re-open after completing | No accidental **redo / double-count** |

---

## SCREEN 10 — Cross-cutting (applies on every screen)
**→ Things that should hold no matter which screen I'm on.**

| ID | Plat | Check | Expected |
| --- | --- | --- | --- |
| XCUT-01 | Both | **Errors** | No screen throws a **visible error** or freezes the flow |
| XCUT-02 | Both | **Loading** | Every screen shows a loader while fetching — **never a blank/white** page |
| XCUT-03 | Both | **Layout** | Safe-area + orientation respected everywhere (nothing under notch/home bar) |
| XCUT-04 | Both | **Network drop** | On any screen, a dropped connection gives a **graceful** message/recovery — no silent data loss |
| XCUT-05 | Both | **Audio on screen change / backgrounding** | Audio **pauses/resumes cleanly** — never overlaps or gets stuck (see 6h for pause/resume) |

---

### Quick-run order
1. **Smoke:** ENTRY-01 → LANDING-03 → COUNTDOWN-01/02 → GAMEPLAY-15 (✓) → GAMEPLAY-16+20 (✗→retry→✓) → GAMEPLAY-34/35/36 (switch app → resume popup) → finish → MEDAL-01/02/03 → (if present) LEADERBOARD-01/03 → END-01.
2. **Then** the rest of each screen, screen by screen.
3. **Then** back/exit (GAMEPLAY-30..33), pause/resume (GAMEPLAY-34..38), resilience (GAMEPLAY-39..43), and cross-cutting (XCUT-*).

> These map to the engineering cases in `worksheet-test-plan.md` (e.g. medal stars-align ↔ MED-001/STAR-003, back-exit ↔ CMP-004/CAP-002, pause/resume ↔ RES-008/AUD-007, leaderboard tabs ↔ LB-004/008). Use this file to verify the *experience*; use that one for the *plumbing* underneath.
