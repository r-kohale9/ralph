# specs/ — Deprecated

Specs have moved to `games/<game>/spec.md`.

This folder contained loose spec files for 5 games. All have been migrated to `games/`:

| Old path | New canonical path |
|----------|-------------------|
| `specs/Adjustment Strategy.md` | `games/adjustment-strategy/spec.md` |
| `specs/Associations.md` | `games/associations/spec.md` |
| `specs/name-the-sides.md` | `games/name-the-sides/spec.md` |
| `specs/quadratic-formula-worked-example.md` | `games/quadratic-formula-worked-example/spec.md` |
| `specs/soh-cah-toa-worked-example.md` | `games/soh-cah-toa-worked-example/spec.md` |

The pipeline reads specs via `warehouse/templates/<game>/spec.md`, which is now a symlink to `games/<game>/spec.md`.

Do NOT add new spec files here. Use `games/<game>/spec.md` directly.
