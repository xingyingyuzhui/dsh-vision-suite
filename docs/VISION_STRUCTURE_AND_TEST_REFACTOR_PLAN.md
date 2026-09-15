# Vision 插件集结构与测试重构 — 现行摘要

状态：**P0–P6 已完成**（2026-09-15）  
完整计划（基线、任务正文、实施记录）：[`archive/VISION_STRUCTURE_AND_TEST_REFACTOR_PLAN.md`](./archive/VISION_STRUCTURE_AND_TEST_REFACTOR_PLAN.md)

## 版本

| 仓 | 版本 | 说明 |
|---|---|---|
| `dsh-vision-bench` | **0.29.0** | 结构/测试重构 + ADR-019～023 |
| `dsh-vision-harness` | **0.2.0** | 入口生命周期测试与 `quality` 门禁 |

## 门禁

| 仓 | 命令 | 结果 |
|---|---|---|
| `dsh-vision-bench` | `npm run quality` | 通过（1245 tests） |
| `dsh-vision-harness` | `npm run quality` | 通过（25 tests） |

## 仍待人工事项

1. **合集 submodule 指针** — 随本提交更新到 Bench `0.29.0` tip（推送后生效）。
2. **Windows / 真机验收** — 见 ADR-023 与 `dsh-vision-bench/docs/WINDOWS_ACCEPTANCE_*.md`。
3. **宿主手测边角** — 真实 `dsh plugin add/remove`、多窗口、client 缓存 bust。

## 结构目标快照

- `src/**` → `bench-*`：deps 规则为 error，0 违规。
- 根门面：≤80 行 re-export；生产 allowlist 为空。
- ADR-019～024 已齐；019–023 补文档欠账。
