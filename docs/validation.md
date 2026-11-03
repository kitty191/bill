# v0.1 验证记录

验证日期：2026-11-02。环境：Linux 云端、Node 24.19.0、npm 11.9.0、Expo SDK 58、系统 Chromium。

| 检查 | 结果 | 覆盖范围 |
| --- | --- | --- |
| `npm ci --no-audit --no-fund` | 通过 | 使用锁文件重新安装 548 个依赖包 |
| `npm run typecheck` | 通过 | 严格 TypeScript 检查 |
| `npm test` | 28 项通过，0 失败 | 整数金额、余额、编辑、转账、分类、数据校验、日期、备份、CSV |
| `EXPO_OFFLINE=1 npm run export:web -- --max-workers 2` | 通过 | 网页生产构建 |
| `npm run test:e2e` | 7 项通过，0 失败 | Chromium 中的完整交互流程，包含失败恢复 |
| Expo iOS 导出 | 通过 | 原生模块解析、JavaScript / Hermes 资源打包 |
| Expo Android 导出 | 通过 | 原生模块解析、JavaScript / Hermes 资源打包 |
| Expo 开发服务器 | 通过 | `/status` 响应、应用 HTML 和实际页面加载 |
| 实际界面截图 | 6 张，运行时异常 0 | 空账本、示例首页、账单、统计、记账面板、深色首页 |
| Android ARM64 Release APK | 通过 | 524 项构建任务完成；私有预览签名、APK v2 签名、16 KB ZIP 对齐、ZIP 完整性、包名/架构/内置代码校验 |

## 安装包构建进展

### v0.1.2 手势与折线图

验证日期：2026-11-03。

- 类型检查、34 项逻辑测试和网页生产构建通过。新增测试覆盖按日累计、收入 / 转账排除、月长 / 闰年、未来日期、单日 / 全零曲线和金额轴。
- Chromium 11 项端到端测试全部通过。新增真实触摸场景覆盖双向切页、底部导航同步、窗口变化、首尾边界、账单拖动不误开编辑、纵向滚动与账户横向滚动独立、筛选保留与重置、折线图点选和月份切换。
- 已检查浅色与深色的实际网页截图，见 `docs/previews/stats-line-chart.png` 和 `docs/previews/stats-line-chart-dark.png`。原生手势、触感与帧率仍待真机验收。

### v0.1.1 图标更新

- 正式图标为 1024 × 1024 RGB PNG，无透明通道；已配置 iOS / Android 传统图标、Android 自适应图标和 Web favicon。
- 原生生成的普通、圆形、自适应前景三种图标资源，均已在最终 APK 中按文件 SHA-256 找到对应内容，确认替换了模板机器人图标。
- Release 构建通过，524 项任务中 50 项执行、474 项复用缓存。APK 版本 0.1.1 / versionCode 2，31,588,718 字节。
- 签名证书与 v0.1.0 完全一致，包名和数据结构不变，支持保留账本的覆盖安装。APK v2 签名、16 KB ZIP 对齐、ZIP CRC 与内置代码均通过检查。
- 类型检查、28 项逻辑测试、网页生产构建通过。校验记录见 `downloads/qingzhang-v0.1.1-android-arm64-verification.json`；尚未真机验收。

### v0.1.0 首次构建

- 已补齐经过官方校验的 JDK 17 / 21、Gradle 9.4.1、Android SDK 37.0、Build Tools 37.0.0、NDK 27.1.12297006 和 CMake。
- 已添加包标识、仓库外的私有预览签名配置，以及可复用 `npm run build:apk`。
- 针对 JitPack 策略拒绝，将 BlurView 官方固定提交的源码作为本地模块编译，保留原始实现与许可证。
- 初次被 `repo.reactnative.dev` 的 403 策略拒绝阻止，联网设置调整后实际下载恢复，`assembleRelease` 成功。APK 为 31,217,369 字节，版本 0.1.0 / versionCode 1、ARM64、最低 API 24、非 Debuggable，并包含独立运行的 Hermes 代码。
- APK 签名、16 KB ZIP 对齐和 ZIP CRC 均通过。包名为 `com.kitty191.qingzhang`，无请求录音、悬浮窗和读写外部存储权限；包含上游 BlurView 许可证。校验记录见 `downloads/qingzhang-v0.1.0-android-arm64-verification.json`。
- 新增 `expo-system-ui` 后的类型检查、28 项逻辑测试和网页生产构建均通过。

七个端到端场景：

1. 收入、支出、转账、修改、删除、搜索与重载；检查月度金额，转账不改变收支。
2. 预算、账户初始余额、示例账本；导出并读取 JSON / CSV 内容。
3. 无效金额、写入失败；表单保留且已保存数据不变。
4. 拒绝无效备份；合法备份在确认前不覆盖，确认后替换。
5. 修改日期后账单移入正确月份。
6. 损坏的本地数据不会被空账本覆盖，可选择有效备份并确认恢复。
7. 320 像素窄屏、深色、减少动态效果模式；记账和导航可操作。

截图使用用户主动载入的示例数据，未将示例设为首次启动默认值；截图来自浏览器中的真实应用，不是原生设备截图。

## 尚未验证

- IPA 尚未生成；Android APK 已构建和签名，尚未在真机安装验收，未上架应用商店。
- 未在 iOS / Android 真机运行 SQLite、文件分享、文件选择、中文键盘、手势与触感。
- 未进行原生设备上的模糊效果、帧率、VoiceOver / TalkBack 和大字号专项检查。
- 应用不提供云同步或自动备份；网页原型按单窗口使用。

用户明确确认 GitHub 账号为 `kitty191`。从其 GitHub 官方账号页面核实用户 ID 为 `265797658`，Author 使用 `kitty191 <265797658+kitty191@users.noreply.github.com>`；Committer 使用 `Codex <codex@openai.com>`。机器中的全局作者配置不代表用户身份；初次误用的作者信息已通过修订提交更正，后续分别显式指定 Author / Committer。
