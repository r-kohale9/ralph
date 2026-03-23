# Count and Tap — Game Spec

> **NOTE:** The canonical spec file for this game was not found in `warehouse/templates/count-and-tap/` or `specs/`. The RCA at `rca.md` references `warehouse/templates/count-and-tap/spec.md` but that file does not exist locally. The game was built and approved (build #551) from a spec that was likely on the server at `/opt/ralph/warehouse/templates/count-and-tap/spec.md`.
>
> **Action required:** SSH to server and copy the canonical spec here:
> `scp -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206:/opt/ralph/warehouse/templates/count-and-tap/spec.md games/count-and-tap/spec.md`
> Then create the warehouse symlink:
> `ln -s ../../../games/count-and-tap/spec.md warehouse/templates/count-and-tap/spec.md`

## Known Game Identity (from rca.md)

**Game ID:** `count-and-tap`
**Parts:** PART-006 (TimerComponent), PART-025 (ScreenLayout), PART-024 (TransitionScreen), PART-013 (Fixed Answer)
**Interaction:** Multiple-choice quiz — dots are briefly shown then hidden, learner selects correct count
**Approved build:** #551 (2026-03-22)
