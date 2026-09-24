## Learned User Preferences

- In `dsh-vision-bench` UI tests, keep structural/component assertions on `react-unit` (no DOM); reserve HappyDOM/`react-runtime` for lifecycle tests. Do not `Window.close()` between tests then recreate—HappyDOM 20 can spin; close only at suite end.
- For Vision Web/Desktop migration, defer hardware/device验收 until explicitly in scope; follow the plan stage order and pause Desktop-dependent stages on B1/B2 probe failure rather than bridging Desktop through Web ports.

## Learned Workspace Facts

- `dsh-vision-bench` public UI components follow ADR-025 (`create*`/`render*` contract); lifecycle wrappers (focus/Escape/`titleId`) must be wired at production call sites, not only in tests.
- `dsh-vision-bench` enforces structure-budget (god files/pages/services typically ≤500 lines; pages stay composition-only)—prefer splits over growing allowlists.
- `dsh-vision-bench` Host top-level inject is `connection` only; UI posts via Fetch `POST /api/vision-bench/dispatch`; legacy `/vision-bench` RPC and Agent HTTP command bridge live in Web-only compat so Desktop never requires `webServer`/ports. The command bridge is user-equivalent by design: a capability-secret caller may write hardware without a separate UI approval, and Keil/OpenOCD/GDB child processes that inherit the secret are inside that trust boundary.
- Agent→Host must not guess `127.0.0.1:3080` or fall back to implicit local `executeHostCommand`; absent Host handle returns `HOST_UNAVAILABLE`.
- `dsh-vision-bench` pins `SUPPORTED_DSH_CONTRACT` to `0.1.7-alpha.2` (re-measured on Desktop 0.1.7-alpha.2). Presets are dual-track: `0.1.5-rc.1`–`0.1.6` keep the directory seed; `0.1.7+` uses declarative `agentPresets.register()`.
- Desktop product-install evidence requires registry `name@version`; local `tgz`/`link` and Desktop probes that patch `serialport` `allowBuilds` / `strict-dep-builds=false` count only as runtime-identity lab/dev evidence, not official product-install proof. Reproducible probes live under `scripts/probes/` (not package `files`).
- Stage 5 acceptance must consume machine-readable Desktop probe evidence (commit/fingerprint); never hardcode Desktop pass as `true`. Absent evidence → `unverified`/fail. Desktop B2 identity pass requires a real Agent fiber (`agent.apply` / `vision.tools.start` + tool call), not bare same-process ESM import + ping.
- Host `apply()` is transactional: publish `activeHostLease`/capability/shared Host only after Fetch/Web registrations succeed; failed init must roll back and must not steal the prior lease.
- Agent point `get`/`list` isolate runtime values by layered ownership; every returned point includes `valueStatus`; `returned` counts unavailable points; `missingIds` means config absent only (not budget truncation); `unavailable` does not authorize Agent auto-rename, rebind, collect, or write.
- Agent read-only point queries (`get`/`list`) must not persist workspace claim or move points into the session private layer; durable claim stays with mutating operations.
