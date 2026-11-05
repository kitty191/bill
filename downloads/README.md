# 清账 Android 预览版

[下载 v0.7.0 APK](https://github.com/kitty191/bill/raw/refs/heads/main/downloads/qingzhang-v0.7.0-android-arm64.apk) · [版本说明](https://github.com/kitty191/bill/releases/tag/v0.7.0-android-preview) · [本轮审查](../docs/review-v0.7.0.md)

版本 0.7.0，versionCode 20，32,660,207 字节，约 31.1 MB。

- 可选的自动文件备份：设置 → 隐私与备份提醒，选择独立目录，按每天 / 每周 / 每月频率在应用前台到期执行。写入并回读校验后才记为成功，保留 7 个有效版本；默认关闭，关闭应用时不保证后台定时执行。
- 改善键盘避让和返回行为，缓存首页 / 月统计结果、减少重复保存校验。修复网页长按释放误点新菜单，以及快速滑动跳过页面。
- 增加真实 SQLite 事务中结束进程的恢复检查、草稿清理失败回滚检查，以及 GitHub Actions 自动回归 / Android 构建。

沿用 v0.6.1 原签名，可直接覆盖安装并保留账本，无需卸载。支持 ARM64 系统 Android 7.0 / API 24 及以上。独立安装包包含应用代码，不需要 Expo Go 或开发服务器。账本 schema 保持 4，首次启动为空账本。卸载前请导出 JSON 并确认文件已保存在独立目录。

Android API 35 模拟器覆盖安装、键盘保存、写入失败恢复、事务中结束进程回滚和重启后的目录备份验收通过（临时测试签名）。类型检查、220 项单元 / 组件测试、79 项完整 Chromium 交互回归、网页 / iOS 资源导出和 Android Release 构建通过。1000 条虚构账单、9 次切页，三个页面均 0 次额外渲染；不代表原生帧率。

APK 已通过原签名、APK v2 签名、16 KB ZIP 对齐、ZIP CRC、ARM64、内置 Hermes / 原生模块、权限和临时计数器缺席检查。CI 模拟器测试包使用临时签名，不能用于更新正式预览包，原生验收结果与限制见审查记录。

云端没有连接真实手机，真机帧率、中文键盘、触感及 iOS 目录授权仍待实机验收。三组网页性能数据没有显示稳定提速，不宣称百分比性能提升。iOS 可能需要重新选择目录，备份文件不加密、不自动上传。IPA 尚未生成。

SHA-256：

```text
0f991aba809517a2ff9a8686a6158fc9bab3e0fb2deab10785b7f04d3a4c0e75
```

[构建校验记录](qingzhang-v0.7.0-android-arm64-verification.json) · [校验和](qingzhang-v0.7.0-android-arm64.apk.sha256)。签名密钥不会上传，旧安装包保留供追溯。
