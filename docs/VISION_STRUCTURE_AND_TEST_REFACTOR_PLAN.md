# Vision 插件集结构与测试重构 — 现行摘要

状态：**P0–P6 已完成**（2026-09-15）  
完整计划（基线、任务正文、实施记录）：[`archive/VISION_STRUCTURE_AND_TEST_REFACTOR_PLAN.md`](./archive/VISION_STRUCTURE_AND_TEST_REFACTOR_PLAN.md)  
后续治理：[`VISION_COMPONENT_REUSE_AND_ENGINEERING_PLAN.md`](./VISION_COMPONENT_REUSE_AND_ENGINEERING_PLAN.md)（组件复用与工程化，进行中）

## 版本

| 仓 | 版本 | 最终提交 | 说明 |
|---|---|---|---|
| `dsh-vision-bench` | **0.29.0** | `8117dbb`（Windows CI 路径修复） | 结构/测试重构 + ADR-019～023 |
| `dsh-vision-harness` | **0.2.0** | 随合集树 | 入口生命周期测试与 `quality` 门禁 |

合集 submodule 指针已由 P0-1 同步到 `8117dbb`（原 `823bf22`）。按用户指示**暂不推送远端**；
因此本地已锁定的提交尚未进入 `origin/main`，全新 clone 暂时拿不到该 Windows 修复。

## 门禁

| 仓 | 命令 | 结果 |
|---|---|---|
| `dsh-vision-bench` | `npm run quality` | 通过（1245 tests，无 skipped/todo） |
| `dsh-vision-harness` | `npm run quality` | 通过（25 tests） |
| `dsh-vision-bench` | Windows 自动化 CI | 通过（`quality.yml`：ubuntu/windows × Node 20/22 四组矩阵；`8117dbb` 为其路径断言修复） |

## 仍待人工事项

1. **推送** — P0-1 的合集指针提交按用户要求留在本地；需要时再推 `origin/main`。
2. **真实 Windows 宿主验收** — `dsh plugin add/remove`、多窗口/session 隔离、client 缓存 bust、Windows 路径手测。
   **自动化 Windows CI 不等于真机验收**，两者是独立证据链。
3. **真实硬件验收** — STM32 + OpenOCD 板级调试、Keil UV4 真机编译、Modbus RTU 从站、Keil UVSC 仿真器。
   状态 `DEFERRED_WINDOWS_ACCEPTANCE`；清单见 `dsh-vision-bench/docs/WINDOWS_ACCEPTANCE_0.27.md`（**仍未执行**）。

## 结构目标快照

- `src/**` → `bench-*`：deps 规则为 error，0 违规。
- 根门面：≤80 行 re-export；生产 allowlist 为空。
- ADR-019～024 已齐；019–023 补文档欠账。
