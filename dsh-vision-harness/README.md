# dsh-vision-harness

Vision 套件的 Harness 护栏，和 `dsh-vision-bench` 分开装：

- **standing-guard**：同一份坏预设只真正挂载一次，确定性 schema 错误按内容摘要缓存，文件变更或显式重试才再挂。
- **scan-guard**：`client-modules` 每批 dirty flush 只拍一次插件树快照。

不包含 UI、工具或预设迁移。那些仍在 `dsh-vision-bench`。

## 安装

```sh
dsh plugin --profile web add link:/Users/qin/DSH/plugins/dsh-vision-suite/dsh-vision-harness
```

`dsh-vision-bench` 0.28 起默认不插入这些 guard。仅在目标 DSH 版本仍会把同一坏预设反复挂载、且已有最小复现时再单独安装。不支持的 DSH 版本不要注入。
