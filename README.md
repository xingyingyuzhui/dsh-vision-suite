# DSH Vision 套件

一组 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 社区插件，面向本地嵌入式与工业控制：**Vision 模式**下传统调试界面、上位机监控和当前 Session 的 Agent 围绕同一份现场状态协同工作。

`dsh plugin add github:` 要求仓库根就是一个插件包，所以每个插件仍是独立仓库。本仓库是合集：说明怎么一起用，并用 submodule 收齐源码。

## 插件

| 插件 | 职责 | 仓库 |
|---|---|---|
| [dsh-vision-bench](./dsh-vision-bench/) | 会话区调试 / 上位机，Keil 编译、Modbus 读写（FC01–06/15/16）、共享任务与时间线，设置页绑定 Keil UV4 / OpenOCD（Node Modbus 运行时），并安装「Vision模式」Agent 预设 | https://github.com/xingyingyuzhui/dsh-vision-bench |
| [dsh-vision-harness](./dsh-vision-harness/) | 失败预设按 generation 缓存、client-modules 每批只扫一次插件树。不包含 UI 或工具 | 本合集内 |

后续可能再加入领域 skill 或其它调试插件。

## 安装

```sh
dsh plugin --profile web add github:xingyingyuzhui/dsh-vision-bench
```

本机开发用 `link:` 指向子目录：

```sh
dsh plugin --profile web add link:/Users/qin/DSH/plugins/dsh-vision-suite/dsh-vision-bench
```

`dsh-vision-harness` 不是默认安装。只有在官方 DSH 仍会把坏预设反复挂载、且已做成最小复现之后，才按适用版本单独加。

装完重启 `dsh web`。新会话选 **Vision模式** 后，Agent 用 `vision_bench` 按需查询和编译/读点/写点。

不要对本合集执行 `dsh plugin add github:xingyingyuzhui/dsh-vision-suite`：合集根目录不是一个 bundle。

### 从合集检出源码

```sh
git clone --recurse-submodules https://github.com/xingyingyuzhui/dsh-vision-suite.git
```

改完插件源码后，在该插件目录执行 `npm test` / `npm run build`，不要手改生成的 `client.js`。

## 规划

现行能力见 [dsh-vision-bench/README.md](./dsh-vision-bench/README.md)。已完成的历史计划在 [docs/archive/](./docs/archive/)。

结构与测试重构（P0–P6）已收口：现行未完成事项见 [docs/VISION_STRUCTURE_AND_TEST_REFACTOR_PLAN.md](./docs/VISION_STRUCTURE_AND_TEST_REFACTOR_PLAN.md)；全文在 [docs/archive/VISION_STRUCTURE_AND_TEST_REFACTOR_PLAN.md](./docs/archive/VISION_STRUCTURE_AND_TEST_REFACTOR_PLAN.md)。

## License

各插件与本合集均为 MIT。
