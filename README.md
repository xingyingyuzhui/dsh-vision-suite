# DSH Vision 套件

一组 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 社区插件，面向本地嵌入式与工业控制：**Vision 模式**下传统调试界面、上位机监控和当前 Session 的 Agent 围绕同一份现场状态协同工作。

`dsh plugin add github:` 要求仓库根就是一个插件包，所以每个插件仍是独立仓库。本仓库是合集：说明怎么一起用，并用 submodule 收齐源码。

当前发布线：**dsh-vision-bench 0.29.17**（Web + Desktop Fetch Host）。`dsh-vision-harness` 0.2.0，默认不装。

## 插件

| 插件 | 职责 | 仓库 |
|---|---|---|
| [dsh-vision-bench](./dsh-vision-bench/) | 会话区调试 / 上位机 / 监控，Keil 编译、Modbus 读写（FC01–06/15/16）、共享任务与时间线，「Vision模式」Agent 预设。Host 顶层只挂 `connection`（`POST /api/vision-bench/dispatch`） | https://github.com/xingyingyuzhui/dsh-vision-bench |
| [dsh-vision-harness](./dsh-vision-harness/) | 失败预设按 generation 缓存、client-modules 每批只扫一次插件树。不包含 UI 或工具 | 本合集内 |

后续可能再加入领域 skill 或其它调试插件。

## 安装

Web：

```sh
dsh plugin --profile web add github:xingyingyuzhui/dsh-vision-bench
```

本机开发在 `dsh-vision-bench/` 里 `npm pack`，再 add 那个 `.tgz`。不要 `link:` 源码树，也不要对合集根执行 `dsh plugin add github:xingyingyuzhui/dsh-vision-suite`。

Desktop：打包应用 **应用 → 桌面插件…** 填 `dsh-vision-bench`（需 npm 发布后才可用）。实验室：完全退出应用后，在 bench 目录执行 `node scripts/probes/install-desktop-local.mjs`。不要 `dsh plugin --profile desktop`。

`dsh-vision-harness` 不是默认安装。只有在官方 DSH 仍会把坏预设反复挂载、且已做成最小复现之后，才按适用版本单独加。

装完重启 `dsh web`（或重开 Desktop）。新会话选 **Vision模式** 后，Agent 用 `vision_bench` 按需查询和编译/读点/写点。

安装、卸载、能力边界和 0.29.4 变更见 [dsh-vision-bench/README.md](./dsh-vision-bench/README.md)。

### 从合集检出源码

```sh
git clone --recurse-submodules https://github.com/xingyingyuzhui/dsh-vision-suite.git
```

改完插件源码后，在该插件目录执行 `npm test` / `npm run build`，不要手改生成的 `client.js`。

## 规划

结构与测试重构（P0–P6）已收口。Web/Desktop 原生接入的 M1（无端口 UI + Agent 同 Host + TCP/仿真）已在 0.29.x 落地；官方 npm 产品安装、Windows 真机、完整 RTU 仍未宣称。现行未完成事项见：

- [docs/VISION_STRUCTURE_AND_TEST_REFACTOR_PLAN.md](docs/VISION_STRUCTURE_AND_TEST_REFACTOR_PLAN.md)
- [dsh-vision-bench/docs/ACCEPTANCE_NATIVE_WEB_DESKTOP.md](dsh-vision-bench/docs/ACCEPTANCE_NATIVE_WEB_DESKTOP.md)

已完成的历史计划在 [docs/archive/](./docs/archive/)。

## License

各插件与本合集均为 MIT。
