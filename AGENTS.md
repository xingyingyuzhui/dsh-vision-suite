## Learned User Preferences

- In `dsh-vision-bench` UI tests, keep structural/component assertions on `react-unit` (no DOM); reserve HappyDOM/`react-runtime` for lifecycle tests. Do not `Window.close()` between tests then recreate—HappyDOM 20 can spin; close only at suite end.

## Learned Workspace Facts

- `dsh-vision-bench` public UI components follow ADR-025 (`create*`/`render*` contract); lifecycle wrappers (focus/Escape/`titleId`) must be wired at production call sites, not only in tests.
- `dsh-vision-bench` enforces structure-budget (god files/pages/services typically ≤500 lines; pages stay composition-only)—prefer splits over growing allowlists.
