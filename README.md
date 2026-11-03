# 清账

简单记录，轻盈生活。一款面向 iOS 和 Android 的极简个人记账应用，采用暖白 / 深绿底色、克制的磨砂玻璃与连贯动效。

目前为可审查的 **v0.1 本地账本原型**。首次打开为空账本，可以在设置中明确选择载入示例。无需注册，不接入广告、分析 SDK 或云端账户。

## 已实现

- 首页：按月收支、结余、预算进度、账户余额、最近记录。
- 切页：首页右滑进入账单，再右滑进入统计；左滑返回。底部导航跟随手势，各页保留滚动位置，账户横向滚动独立处理。
- 记账：支出、收入、账户转账；分类、日期、备注；编辑、二次确认删除。
- 账单：月份切换、类型筛选、备注 / 分类 / 账户搜索、按日分组。
- 统计：支出分类占比与排行、每日支出折线图、上月对比。轻触折线查看当天金额，缺少支出的日期按零显示；收入和转账不计入曲线。
- 设置：账户名称与初始余额、添加账户、所有月份共用的预算。
- 数据：完整 JSON 备份与恢复、CSV 导出；导入前校验与确认；存储失败保留输入；损坏数据的备份恢复入口。
- 外观：跟随系统深浅模式、底部浮动玻璃导航、跟手的分页与导航指示器、记账按钮反馈、可拖动面板、系统减少动态效果适配。

## 开发

需要 Node.js 24（至少 24.3，当前验证版本 24.19）、npm 11。使用已有检出目录，无需额外 worktree。

```sh
cd /workspace/bill
npm ci
npm run web
```

手机开发：在可以连接手机的开发机器上检出仓库，执行 `npm ci` 和 `npm start`，使用支持 Expo SDK 58 的 Expo Go 或开发构建。iOS 模拟器需要 macOS / Xcode，Android 模拟器需要 Android SDK；云端的网页检查不代表原生真机验证。

当前技术栈：Expo SDK 58、React Native 0.88、React 19.3、TypeScript 6、Reanimated 4、SQLite。版本以 `package-lock.json` 为准。

Android 预览版：[下载 v0.1.1 APK](https://github.com/kitty191/bill/raw/refs/heads/main/downloads/qingzhang-v0.1.1-android-arm64.apk)，约 30 MB，支持 ARM64 系统的 Android 7.0 及以上手机，内含应用代码，无需 Expo Go 或开发服务器。新版使用深绿账本与叶片图标，沿用原签名，可直接覆盖安装 v0.1.0。该包已通过签名与完整性检查，仍待真机验收。详见 [下载说明](downloads/README.md)。

独立 APK 构建入口为 `npm run build:apk`，工具链、私有签名配置和网络前提见 [Android 构建说明](docs/android-build.md)。IPA 尚未生成，另需 macOS / 远程构建服务及 Apple 签名。

受限网络下，Metro 可以使用 `EXPO_OFFLINE=1 npm run web -- --localhost`。如需安装 SDK 模块，使用 SDK 自带映射：`EXPO_OFFLINE=1 npx expo install <模块>`；npm 仍需访问官方包仓库，不关闭 TLS 或完整性校验。

## 验证

```sh
npm run typecheck
npm test
npm run export:web -- --max-workers 2
npm run test:e2e
```

端到端测试使用 Chromium，默认路径 `/usr/bin/chromium`，可通过 `CHROMIUM_PATH` 指定浏览器可执行文件。测试自动启动本机静态服务器；先执行网页导出。测试覆盖真实的新增、转账、编辑、删除、重载、预算、账户管理、导出、恢复、存储失败、窄屏深色流程，以及触摸切页、首尾边界、嵌套滚动和折线图点选。

原生 JavaScript / 资源导出：

```sh
EXPO_OFFLINE=1 npx expo export --platform ios --platform android --output-dir /tmp/qingzhang-native --max-workers 2
```

这能验证两个原生平台的模块与打包，不能代替生成安装包、SQLite 原生运行、真机触感、键盘、玻璃效果和帧率测试。

## 数据说明

- 所有金额使用整数分计算；当前单笔上限 ¥9,999,999.99，仅支持人民币。
- 账户余额 = 初始余额 + 全部账单变动；支持负余额。初始余额和账户转账都不计入收支。
- 手机使用 SQLite 单行 JSON 快照，写入为单条原子 SQL。网页使用当前浏览器的 `localStorage`，适合原型审查，按单窗口使用。
- schema 版本为 1。读取与写入均校验；不识别的版本拒绝覆盖，后续升级需显式迁移。
- 数据保存在本机，尚未实现额外的应用层加密、云同步和自动备份。卸载 / 清除应用数据可能丢失账本，请定期导出 JSON。CSV 用于查看，不用于恢复。
- JSON 备份包含全部财务数据，请妥善保管；恢复会替换当前账本，应用内需再次确认。

## 设计与后续

见 [产品与设计决策](docs/product.md) 和 [验证记录](docs/validation.md)。截图见 `docs/previews/`。

当前玻璃通过 Expo Blur 实现，并非复刻系统 Liquid Glass 的真实折射。Android 12+ 使用原生模糊，较旧系统使用半透明降级。原生效果和性能仍需真机校准。

Git Author 主作者为用户确认的 GitHub 账号 `kitty191`，使用隐私邮箱 `265797658+kitty191@users.noreply.github.com`；云端 Committer 为 `Codex <codex@openai.com>`。两者分别显式指定，不能将机器或全局 Git 配置当作用户身份。

提交消息同时加入 `Co-authored-by: Codex <codex@openai.com>`，记录 Codex 的联合贡献。GitHub 账号归属及 Contributors 展示取决于邮箱关联与平台索引。
