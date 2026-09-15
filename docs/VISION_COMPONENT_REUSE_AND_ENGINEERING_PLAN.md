# Vision 插件集组件复用与工程化治理计划

状态：**Proposed**  
范围：`dsh-vision-bench`、`dsh-vision-harness` 与合集收口  
基线：Bench `0.29.0`（当前检出 `8117dbb`），Harness `0.2.0`  

## 1. 决策

本轮继续采用**模块化单体插件**，不拆成多个 npm 插件或微包。

目标不是为了“组件化”制造更多转发层，而是把真正跨页面重复、具有统一交互语义的 UI 和测试基础设施收敛到稳定公共层，并用自动门禁防止重新复制。

建议分层：

```text
src/ui/styles/       设计 token、基础样式、领域样式入口
src/ui/components/   无业务语义的基础组件
src/ui/patterns/     被至少两个功能域复用的组合模式
src/ui/<feature>/    HMI、debug、monitor、settings 等领域功能
test/helpers/        跨测试文件复用的运行时、工厂和 fixture
```

公共层的判定标准：至少两个真实调用方，API 能用领域无关语言描述，并且抽取后不会隐藏业务状态或权限判断。单一页面专用视图继续留在功能目录。

## 2. 当前基线

- `src/ui/components/` 有 8 个公共模块，约 29 个生产模块直接使用。
- `custom-select` 有 13 个调用方；`Panel/Tabs/Hint` 和保存/取消按钮各有 5 个调用方；`data-table`、`modal-dialog` 各有 3 个调用方。
- 本轮结构重构没有新增公共 UI 组件，主要成果是页面、Hook、controller、model 和样式入口拆分。
- `test/helpers/` 已形成有效复用：React runtime 被约 20 个测试使用，workspace factory 和 RPC factory 各被约 14 个测试使用。
- 生产文件无 `>500` 行，但仍有 18 个 `>400` 行；测试文件无 `>500` 行，但仍有 12 个 `>350` 行。
- Bench/Harness 本地质量门禁通过；Ubuntu/Windows × Node 20/22 CI 通过。
- 合集提交仍锁定 Bench `823bf22`，当前工作区检出的 Windows 修复 `8117dbb` 尚未写入合集 submodule 指针。

## 3. 完成定义

### 3.1 必须完成

- [ ] 合集锁定包含 Windows 修复的 Bench 提交，工作树除用户已有文件外保持清晰。
- [ ] `src/ui/components/**` 不得导入 HMI、debug、monitor、settings 等功能模块。
- [ ] `src/ui/patterns/**` 只允许依赖公共组件、公共 UI 工具和 vendor adapter，不反向依赖具体页面。
- [ ] Dialog、Select、Toggle、DataTable、SourceEditor、保存/取消操作组均有直接行为测试。
- [ ] 公共组件覆盖可访问名称、键盘/点击行为、disabled/loading、事件回调和卸载清理。
- [ ] 重复 UI 家族具有唯一实现所有者；受保护 class/DOM 不允许在所有者之外重新实现。
- [ ] 根目录 `bench-*.mjs` 通过语法门禁保证为纯 re-export；特殊兼容常量必须显式登记。
- [ ] `no-orphans` 提升为 error；合法入口使用精确 allowlist，禁止通配目录。
- [ ] Bench 与 Harness `quality` 全绿，无 skipped/todo，覆盖率不低于当前门槛。
- [ ] `npm pack` 清单无重复、ghost path 或 import closure 缺口。
- [ ] 公共导出兼容，客户端 bundle 不突破经审查的体积预算。

### 3.2 质量目标

- [ ] 人工维护生产文件原则上 `<=400` 行；确实不可拆者进入带 owner、理由和复审日期的 allowlist。
- [ ] 测试文件原则上 `<=350` 行；超限测试必须按场景拆分，不能只移动到 helper 隐藏复杂度。
- [ ] 新公共组件只接受第二个真实调用方驱动，不为未来假设提前抽象。
- [ ] 页面中不得复制公共组件的状态、交互和可访问性逻辑；纯文本容器和一次性布局不强制组件化。
- [ ] 每个实施任务形成聚焦提交；纯移动、行为修改、生成物更新和合集指针更新分开提交。

## 4. 分阶段任务

### P0：发布与事实收口

#### [ ] P0-1 同步 Bench 指针（30 分钟）

- 将合集 submodule 从 `823bf22` 更新到已通过四组 CI 的 `8117dbb` 或更新提交。
- 更新现行结构计划中关于 Windows 和 submodule 的描述。
- 不触碰现有 `.cursor/` 等用户文件。

**验收：**全新 clone + submodule update 得到 Windows-safe 版本；Suite 工作区不再因指针错位显示修改。

#### [ ] P0-2 修正历史验收记录（30–60 分钟）

- 将版本、最终提交、CI 结果和未完成人工验收写回计划摘要。
- 明确区分“自动化 Windows CI”和“真实 Windows 宿主/真机验收”。
- 未完成项不得继续标记为完成。

**验收：**文档、Git、package version 和 submodule 指针相互一致。

### P1：公共层契约与重复清单

#### [ ] P1-1 建立组件与模式清单（45–60 分钟）

- 记录每个公共模块的职责、调用方、状态所有权、可访问性要求和测试文件。
- 盘点 Dialog、Drawer、Select、Toggle、Tabs、Panel、Hint/EmptyState、StatusBadge、FormActions、Table、FilterToolbar、Pagination、DetailCard。
- 标记“复用”“领域特有”“重复待合并”“不值得抽取”四类结论。

**验收：**每个候选项都有真实文件和调用方证据，不以 class 名相似代替行为重复判断。

#### [ ] P1-2 确立公共组件 API 规范（30–60 分钟）

- 统一 React 注入、命名和返回方式，明确 `createX(React)` 与纯 `renderX(el, ...)` 的适用边界。
- 统一 `className/style/disabled/loading/aria-*` 等基础参数约定。
- 规定受控状态、事件回调、错误展示和 i18n fallback 的责任归属。

**验收：**新增 ADR 或工程规范；现有组件逐项标记“符合/待迁移”，本任务不做大规模实现改写。

#### [ ] P1-3 建立组件测试 harness（45–60 分钟）

- 从现有测试中抽取统一的轻量 React renderer、节点查询、事件触发和 cleanup。
- 与 `test/helpers/react-runtime.mjs` 分工清楚：组件单测使用轻量 harness，页面真实副作用测试使用完整 runtime。

**验收：**至少迁移 `primitives`、`custom-select`、`data-table` 三组测试，测试代码减少且断言语义不变。

### P2：基础组件补齐与统一

#### [ ] P2-1 补齐现有组件直接测试（每个组件 30–60 分钟）

按独立提交依次覆盖：

1. `modal-dialog`
2. `save-cancel-buttons`
3. `toggle-switch`
4. `source-editor`
5. `viz-grid`

**验收：**覆盖正常、disabled/loading、事件边界、ARIA 和清理行为；测试不读取生产源码文本。

#### [ ] P2-2 收敛基础 token（45–60 分钟）

- 在现有 typography/style token 基础上补齐语义颜色、间距、圆角、边框和层级。
- 优先映射宿主 `--dsw-alias-*`，Vision token 只提供稳定语义和 fallback。
- 清理公共组件内重复的 magic number；领域图表颜色不强行并入基础 token。

**验收：**公共组件不各自定义同义颜色/圆角；暗色和宿主主题行为不退化。

#### [ ] P2-3 统一组件 API（每组 30–60 分钟）

- 分组迁移 Select、Dialog、Action、Toggle、Panel/Tabs。
- 保留必要兼容导出，并在调用方迁移完成后删除旧别名。
- 不在本阶段改变视觉和业务行为。

**验收：**调用方、直接测试、页面行为测试全部通过；无一次性转发 wrapper。

### P3：高价值组合模式复用

#### [ ] P3-1 空状态与状态呈现（45–60 分钟）

- 对比 HMI、Frames、Journal、Alarm、Visualization、Debug 的空状态和状态标签。
- 只抽取共同的语义、ARIA 和布局骨架；文案和业务动作由功能模块传入。

**验收：**至少两个功能域真实复用；错误、等待、空数据三类状态可区分且可测试。

#### [ ] P3-2 表格工具模式（每个调用方 30–60 分钟）

- 收敛 DataTable 周边的 FilterToolbar、Pagination、列宽持久化和详情面板组合。
- Frames、Journal、Alarm 分批迁移，一个功能域一个提交。

**验收：**稳定 row id、虚拟化、排序、列宽和详情选择行为保持不变；5000 行虚拟化测试继续通过。

#### [ ] P3-3 表单与弹层模式（每个调用方 30–60 分钟）

- 收敛 FormActions、ModalDialog 和必要的 Drawer 骨架。
- Visualization 的复杂编辑抽屉允许保留独立模式，但不得复制通用 Dialog 的焦点、关闭和 ARIA 行为。

**验收：**遮罩关闭、Escape、确认/取消、危险操作、loading 和焦点恢复具有一致契约。

#### [ ] P3-4 Debug 面板复用收口（45–60 分钟）

- 将 Stack、Variables、Breakpoints、Timeline 的 Panel/Tabs/Hint 用法统一到公共 API。
- 清理仍直接复制相同 panel header/body 结构的实现。

**验收：**公共 panel 结构只有一个实现所有者；Debug 页面行为和 CSS selector 保持兼容。

### P4：测试工程继续瘦身

#### [ ] P4-1 拆分超限 helper（每个 30–60 分钟）

- 优先处理 `hmi-page-fixtures.mjs`，按 transport、render、state fixture 拆分。
- 检查 `react-runtime`、`rpc-factory`、`workspace-factory` 是否同时承担不相关职责。

**验收：**helper 按职责组织，不出现万能 fixture；使用方导入名称能够说明场景。

#### [ ] P4-2 拆分 12 个 `>350` 行测试（每个 30–60 分钟）

- 按行为场景拆分，而不是按行数平均切割。
- 共用 arrange 进入领域 fixture，断言和业务步骤留在测试中。

**验收：**测试清单只增加不丢失；无 skipped/todo；失败信息能直接定位场景。

#### [ ] P4-3 清理低价值源码锁定（45–60 分钟）

- 复查剩余 22 个生产源码读取测试。
- 能用导出契约、渲染行为或依赖图证明的，替换源码字符串断言。
- 保留发布、安全禁用、生成物和明确架构规则，并使用精确 allowlist。

**验收：**`pending-refactor` 为零；allowlist 每项都有类别和精确目标。

### P5：自动防回退门禁

#### [ ] P5-1 公共层依赖门禁（30–60 分钟）

- 增加 `components-no-features`、`patterns-no-features` 等 dependency-cruiser error 规则。
- 禁止页面绕过 `src/ui/vendor/*-runtime.mjs` 直接绑定第三方运行时。

**验收：**人为加入反向依赖的 fixture 能稳定失败；当前依赖图零违规。

#### [ ] P5-2 UI 实现所有权门禁（45–60 分钟）

- 为 Dialog、Select、DataTable、Toggle、Panel 等受保护 DOM/class 建立所有者清单。
- 架构测试扫描生产模块；所有者之外不得重新声明完整组件结构。
- 样式文件、测试 fixture 和确有差异的领域模式走精确例外。

**验收：**复制一份受保护实现会使质量门禁失败；普通 class 使用不会误报。

#### [ ] P5-3 门面纯度与 orphan 门禁（45–60 分钟）

- 使用 AST 检查根 `bench-*.mjs` 默认只包含 re-export。
- 将 `no-orphans` 从 info 提升为 error。
- 入口、worker、脚本使用带理由的精确 allowlist。

**验收：**加入 80 行以内的业务逻辑或孤立模块都会失败；现有合法入口全绿。

#### [ ] P5-4 结构预算升级（30–60 分钟）

- 保持生产/测试 `500` 行硬上限。
- 将 `400/350` 变为不可静默增长的债务预算：每次提交只能持平或下降。
- allowlist 必须包含职责理由、owner、创建日期和复审日期。

**验收：**新增超目标文件或扩大债务总量会失败，机械拆 wrapper 由审查规则阻止。

### P6：剩余大文件按职责拆分

按风险和复用收益分批处理，每个文件单独评审：

1. UI session/controller：`use-project-session`、`use-frames-page`、`hmi-page`
2. 公共组件：`custom-select`
3. interfaces/application：RPC router、polling service、debug launch spec
4. infrastructure/runtime：journal store、uvsock client、connection manager、I/O broker
5. domain model：visualization、program、point model

**每个任务验收：**公开导出兼容；拆分依据是职责或可复用边界；相关测试先绿、拆后仍绿；不新增循环和 orphan。

### P7：全量验收与发布收口

#### [ ] P7-1 自动化验收（45–60 分钟）

- Bench `npm run quality`
- Harness `npm run quality`
- Ubuntu/Windows × Node 20/22 CI
- pack 内容与 import closure
- 公共导出 diff
- client raw/gzip 体积对比

#### [ ] P7-2 宿主与真机验收（按环境执行）

- 真实 `dsh plugin add/remove`
- 多窗口/session 隔离
- client 缓存 bust
- Windows 宿主路径、Keil/OpenOCD、串口/Modbus 真机

#### [ ] P7-3 版本与合集指针（30–60 分钟）

- Bench 版本、CHANGELOG、生成 client 单独提交。
- Harness 有实际变更时再 bump。
- Bench 提交推送并通过 CI 后，合集单独更新 submodule 指针和计划状态。
- 未经用户明确批准，不执行 npm publish 或 release tag。

## 5. 轻量代码级设计

本节定义目标文件和接口形状，用来减少实施者二次设计；代码片段只表示契约，不要求逐字照搬。

### 5.1 公共层目标文件

```text
src/types/ui-runtime.d.ts                 React 注入运行时的最小结构类型
src/types/ui-components.d.ts              公共组件 Props 与事件类型
src/ui/components/component-utils.mjs     cx、resolveText 等无状态小工具
src/ui/components/button.mjs              通用按钮语义
src/ui/components/custom-select.mjs       Select 行为与生命周期唯一所有者
src/ui/components/data-table.mjs          表格、虚拟化、键盘选择唯一所有者
src/ui/components/modal-dialog.mjs        Dialog 结构与生命周期唯一所有者
src/ui/components/empty-state.mjs         通用空/等待/错误状态
src/ui/components/status-badge.mjs        通用状态标签
src/ui/components/toggle-switch.mjs       Switch 行为唯一所有者
src/ui/components/source-editor.mjs       CodeMirror adapter
src/ui/components/viz-grid.mjs            GridStack adapter
src/ui/patterns/form-actions.mjs           表单操作组合
src/ui/patterns/filter-toolbar.mjs         过滤器布局组合
src/ui/patterns/detail-layout.mjs          列表 + 详情布局组合
src/ui/patterns/drawer.mjs                 复杂编辑抽屉生命周期
```

`component-utils.mjs` 只接受已经出现两次以上的稳定工具，不得演化成杂物箱。公共模块继续使用直接文件导入，不新增大而全的 `index.mjs` barrel，以便依赖图保持可见。

### 5.2 React 注入与组件 API

生产代码统一以 React runtime factory 作为公开入口：

```js
export function createButton(React) {
  return function Button(props) {}
}
```

规则：

- `createX(React)` 返回稳定组件类型；同一页面不能在每次 render 中重新创建。
- `renderX(el, props)` 只用于无 Hook 的纯渲染和兼容测试，不承载订阅或生命周期。
- 需要 i18n、vendor 或 Host adapter 时通过 factory 参数显式注入，不在组件内部读取全局单例。
- Props 使用 JSDoc 引用 `src/types/ui-components.d.ts`；公共组件必须 `// @ts-check`。
- 组件只通过 props 上报意图，不直接读写 workspace、session、RPC 或设备状态。

建议最小 Button 契约：

```js
Button({
  variant: 'default' | 'primary' | 'danger' | 'ghost',
  size: 'sm' | 'md',
  loading,
  disabled,
  ariaLabel,
  onClick,
  className,
  children,
})
```

实现必须统一 `type="button"`、`disabled || loading`、`aria-busy` 和 class 拼接。图谱节点、表格 resize handle 等具有专门交互语义的控件不强制改成 Button。

### 5.3 现有组件逐项改造

#### `custom-select.mjs`

当前无显式 `id` 时统一回退为 `dvb-select`，同页多个 Select 会产生重复 `listbox` ID。计划：

- 优先使用 `React.useId()` 生成稳定 ID；测试/旧 runtime 不支持时使用工厂内递增 ID。
- 保留调用方显式 `id` 的最高优先级。
- 将 open/highlight/value 三类受控状态写入 Props 类型，禁止真假受控模式混用。
- 保持 `getCustomSelect(React)` 的 WeakMap 缓存，避免组件类型随 render 改变。
- 补测 ArrowUp/Down、Home/End、Enter/Space、Escape、Tab、disabled option、外部点击和事件监听清理。

目标测试：`test/ui/custom-select.test.mjs`；新增多实例 ID 和真实卸载场景。

#### `modal-dialog.mjs`

当前只有遮罩点击和按钮回调，没有 Escape、初始焦点、焦点恢复以及标题关联。计划：

- 保留 `renderModalDialog` 作为纯结构函数；生命周期进入 `createModalDialog`。
- 增加 `closeOnEscape`、`initialFocusRef`、`restoreFocus`，默认值遵循普通 Dialog 行为。
- 在真实 dialog 节点设置 `role="dialog"`、`aria-modal`、`aria-labelledby`、可选 `aria-describedby`。
- 打开时保存原焦点，关闭/卸载时恢复；Escape 只触发一次 `onClose`。
- 确认按钮支持 `loading/disabled`，危险操作使用 Button 的 `danger` variant。

目标测试：新增 `test/ui/modal-dialog.test.mjs`，覆盖 Alert、Confirm、maskClosable、Escape、焦点和卸载。

#### `toggle-switch.mjs`

当前原生 `button` 同时注册 `onClick` 和 Space/Enter 的 `onKeyDown`。浏览器可能再合成一次 click，存在重复 `onChange` 风险。计划先写真实 DOM 回归测试，再决定：

- 若确认重复，删除手写 Enter/Space 路径，依赖原生 button click；或确保只在单一事件阶段触发。
- `aria-label` 和可见 label 至少存在一个；没有名称时开发测试必须失败。
- disabled 状态不得触发回调。

目标测试：新增 `test/ui/toggle-switch.test.mjs`。

#### `data-table.mjs`

- Props 增加 `ariaLabel/ariaLabelledBy`，页面必须提供其一。
- 选中行输出 `aria-selected`；键盘移动后保证选中行可见。
- 保持 `getRowId` 必填、虚拟化 row key 稳定和 fallback cap。
- resizer 补充可访问名称；不把拖拽逻辑混入业务列定义。
- `onRowClick` 与调用方 `extraOnClick` 的调用顺序写入契约并测试。

目标测试：扩充 `test/ui/data-table.test.mjs`，保留 5000 行只渲染可视区的性能回归。

#### `source-editor.mjs`

- 明确 `text/language/rel` 变化允许重建 EditorView，`jumpLine/execLine/breakpoints` 只 dispatch effect。
- fake/real CodeMirror 均验证 `destroy()` 恰好一次。
- fallback `<pre>` 增加可访问标签，并与真实编辑器保持 `data-rel/data-jump-line` 契约一致。

目标测试：新增 `test/ui/source-editor.test.mjs`，不再用源码字符串证明生命周期。

#### `viz-grid.mjs`

- GridStack 只能通过 `src/ui/vendor/grid-runtime.mjs` 获取。
- 固化 `init → on(change) → off → destroy(false)` 生命周期顺序。
- `readOnly/editing` 变化只更新实例，不重复初始化。
- `onLayout` 不得在 props 同步期间回传，保持 `syncingRef` 防环逻辑。

目标测试：扩充 `test/ui/viz-grid.test.mjs` 的重渲染、卸载和只读切换场景。

### 5.4 新增公共组件的边界

#### `button.mjs`

迁移顺序：保存/取消按钮 → Dialog footer → 普通 primary/danger 按钮。首轮不迁移图谱、表格 resize、文件树 trigger 等特殊控件。

验收：同一种 variant 只有一个 class 组装位置；loading/disabled/ARIA 行为有直接测试。

#### `empty-state.mjs`

建议契约：

```js
EmptyState({ kind: 'empty' | 'loading' | 'error', title, detail, action })
```

先迁移 Frames、Journal、Alarm 中结构相同的状态，再评估 HMI/Visualization。业务恢复动作由页面传入，组件不得知道 RPC。

#### `status-badge.mjs`

建议只负责 `kind + label + title` 的呈现，不接收设备、告警或任务对象。领域模块先把业务状态投影为公共 `kind`。

#### `patterns/*`

- `form-actions` 组合 Button，不复制按钮逻辑。
- `filter-toolbar` 只负责布局、折叠和 clear 区域，不拥有过滤规则。
- `detail-layout` 只负责 master/detail 布局，不拥有选中状态。
- `drawer` 复用 Dialog 生命周期，但允许不同视觉容器。

任何 pattern 在第二个调用方完成迁移前保持功能目录私有；只有复用成立后才移入 `src/ui/patterns/`。

### 5.5 UI 类型检查落地

现有 `tsconfig.check.json` 不包含 UI，`check-typecheck-files.mjs` 的核心目录也没有 `src/ui`。当前约 170 个 UI 模块仅约 18 个声明 `@ts-check`，8 个公共组件中只有 `primitives.mjs` 开启检查。

采用独立配置，避免一次性让全部历史 UI 阻塞：

```text
tsconfig.ui-check.json
  include:
    src/ui/components/**/*.mjs
    src/ui/common/**/*.mjs
    src/ui/patterns/**/*.mjs
    src/ui/vendor/**/*.mjs
    src/types/ui-*.d.ts
  lib: ES2022, DOM
```

新增脚本：

```json
{
  "typecheck:ui": "tsc -p tsconfig.ui-check.json",
  "ui:architecture:check": "node scripts/check-ui-ownership.mjs",
  "facades:check": "node scripts/check-facade-purity.mjs"
}
```

`quality` 顺序建议为：build → lint → core typecheck → UI typecheck → deps → facade purity → UI ownership → structure → source assertions → coverage → pack。

后续每迁移一个功能目录，就把该目录加入 UI typecheck；不得用 `@ts-nocheck` 消除错误。

### 5.6 依赖规则具体形状

在 `dependency-cruiser.config.mjs` 增加：

```js
{
  name: 'ui-components-no-features',
  severity: 'error',
  from: { path: '(^|/)src/ui/components/' },
  to: { path: '(^|/)src/ui/(debug|hmi|monitor|settings|workspace)/' },
}
```

`patterns` 使用同类规则；允许依赖 `components/common/vendor`，禁止依赖具体功能目录。另加 `ui-no-direct-vendor-packages`，除 `src/ui/vendor/**` 和 `scripts/vendor-entry.mjs` 外禁止直接导入 CodeMirror、TanStack、ECharts、GridStack、uPlot。

`no-orphans` 改为 error 后，入口清单至少区分：Host 入口、Client 入口、worker、CLI script、类型声明；每项必须是精确路径。

### 5.7 UI 所有权门禁实现

新增：

```text
scripts/ui-ownership-policy.mjs
scripts/check-ui-ownership.mjs
test/architecture/ui-ownership.test.mjs
```

策略采用“受保护 selector 前缀 → 唯一实现文件”：

```js
export const UI_OWNERS = {
  'dvb-select': 'src/ui/components/custom-select.mjs',
  'dvb-data-table': 'src/ui/components/data-table.mjs',
  'dvb-dialog': 'src/ui/components/modal-dialog.mjs',
  'dvb-setting-switch': 'src/ui/components/toggle-switch.mjs',
  'dvb-debug-panel': 'src/ui/components/primitives.mjs',
}
```

门禁只检查创建 DOM 的生产 `.mjs`，样式定义和测试 fixture 不算重复实现。迁移期间支持精确路径临时 allowlist，条目必须带 owner、原因和删除阶段；P7 时临时条目清零。

### 5.8 门面纯度门禁实现

新增 `scripts/check-facade-purity.mjs`，使用项目已经直接依赖的 TypeScript compiler API 解析 AST，不依赖正则，也不依赖间接安装的 Acorn。

默认允许：

- `ExportDeclaration`
- 注释和空语句

默认禁止：

- `ImportDeclaration`
- 函数、类、变量和顶层调用
- 从另一个 `bench-*` 门面继续转发

确需保留的常量通过 `scripts/facade-compat-allowlist.mjs` 按“文件 + export 名”登记。`bench-actions.mjs#listDir` 和 `bench-listdir.mjs#listDir` 先迁入 `src/`，再启用硬门禁。

目标测试：新增 `test/architecture/facade-purity.test.mjs`，至少包含纯转发通过、短函数失败、跨门面转发失败、过期 allowlist 失败四种 fixture。

### 5.9 分批迁移文件清单

#### Batch A：低风险公共行为

- `src/ui/settings/settings-page.mjs`
- `src/ui/hmi/connection-form.mjs`
- `src/ui/hmi/device-form.mjs`
- `src/ui/hmi/csv-transfer.mjs`
- `src/ui/hmi/device-card-item.mjs`

迁移 Button、Toggle、FormActions；不改保存协议和 HMI 状态模型。

#### Batch B：Debug chrome

- `src/ui/debug/runtime/{stack,variables,breakpoint,debug-timeline}-panel.mjs`
- `src/ui/debug/runtime/debug-toolbar.mjs`
- `src/ui/debug/debug-{project,output,flash}-panel.mjs`

迁移 Panel、Tabs、Hint 和 Button；保持现有 CSS selector，避免视觉重构混入。

#### Batch C：Monitor 列表模式

- `src/ui/monitor/frames/*`
- `src/ui/monitor/journal/*`
- `src/ui/monitor/alarms/*`

依次迁移 FilterToolbar、DataTable、DetailLayout、EmptyState；每个功能域一个提交。

#### Batch D：Visualization

- `src/ui/monitor/visualization/components/viz-editor-panel.mjs`
- `src/ui/monitor/visualization/components/viz-empty-state.mjs`
- `src/ui/monitor/visualization/components/viz-card.mjs`

最后迁移 Drawer、FormActions、EmptyState。图表 renderer 和领域校验不进入公共 UI 层。

### 5.10 组件级测试矩阵

| 组件 | 必测行为 |
|---|---|
| Button | variant、loading、disabled、单次 click、ARIA |
| CustomSelect | 唯一 ID、受控/非受控、全键盘路径、disabled option、监听清理 |
| ModalDialog | Alert/Confirm、Escape、遮罩、焦点进入/恢复、危险/加载状态 |
| ToggleSwitch | click/Space/Enter 均只触发一次、disabled、可访问名称 |
| DataTable | row id、排序、选择、键盘、虚拟化、resize、ARIA |
| SourceEditor | fallback、创建、prop 更新、effect dispatch、destroy 一次 |
| VizGrid | init、同步、change、防回环、只读切换、off/destroy |
| EmptyState | empty/loading/error 语义和 action |

组件单测使用轻量 harness；涉及 document/window 监听、焦点和 vendor 生命周期的用例使用 `test/helpers/react-runtime.mjs`。不得通过搜索源码字符串代替行为测试。

### 5.11 每个代码任务的固定步骤

1. 写或补行为测试，记录修改前基线。
2. 做纯移动/抽取，公开 API 暂不变。
3. 迁移一个真实调用方并运行相关测试。
4. 迁移第二个调用方，确认抽象确实成立。
5. 删除旧实现或加入有期限的兼容层。
6. 运行 typecheck、deps、ownership、coverage 和 pack 相关门禁。
7. 单独提交生成物；合集指针另一个提交。

禁止在同一任务中同时调整视觉、文案、业务状态和公共组件 API。若迁移暴露现有行为缺陷，先增加失败回归测试，再用独立提交修复。

## 6. 实施顺序与提交策略

推荐顺序：`P0 → P1 → P2 → P5 → P3 → P4 → P6 → P7`。

先建立契约和门禁，再迁移页面，避免治理期间继续产生重复。P3/P4/P6 可以按功能域穿插，但同一提交不得同时包含无关 UI、测试和业务行为变化。

每个提交必须记录：

1. 修改前问题与真实调用方；
2. 本提交的单一职责；
3. 相关测试与完整门禁结果；
4. API、视觉、bundle、发布包是否变化；
5. 下一项可独立执行的任务。

## 7. 预计工作量

- P0：0.5–1 天
- P1：1–1.5 天
- P2：2–3 天
- P3：3–5 天
- P4：2–4 天
- P5：1.5–2.5 天
- P6：4–8 天，取决于大文件真实职责
- P7：1–2 天，不含等待真机环境

建议按两轮交付：

- **第一轮（P0/P1/P2/P5）：**公共层契约、直接测试和自动门禁，约 5–8 天。
- **第二轮（P3/P4/P6/P7）：**调用方迁移、剩余债务和发布验收，约 10–19 天。

## 8. 本轮非目标

- 不拆成多个插件或 npm 微包。
- 不借组件治理改视觉风格或业务流程。
- 不强制把每个文本容器、按钮或单次布局包装成组件。
- 不把领域状态机塞进公共 UI 组件。
- 不以降低行数为唯一目标，不制造无意义 wrapper。
- 不用源码字符串测试代替真实行为和依赖规则。
