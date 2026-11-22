# 清账 Android 预览版

[下载 v0.8.7 APK](https://github.com/kitty191/bill/raw/refs/tags/v0.8.7-android-preview/downloads/qingzhang-v0.8.7-android-arm64.apk) · [版本说明](https://github.com/kitty191/bill/releases/tag/v0.8.7-android-preview)

版本 0.8.7 / versionCode 28，32,998,855 字节，约 31.5 MB。
ARM64、Android 7.0+，独立安装包，沿用 v0.8.6 的包名和签名，可直接覆盖安装。

# 清账 v0.8.7

- 调整首页、账单和统计的视觉层级，统一卡片、月份选择器和底部操作栏。
- 给计算键盘的数字、运算符和清除键加上不同的视觉样式。设置按记账偏好、月度预算和数据备份分组。
- 保存后的提示跟随底栏高度，图表浮层在窄屏上留在绘图区域内。

此安装包使用 `com.kitty191.qingzhang.app` 和原签名。已安装 v0.8.6 的用户可直接选择「更新」。若仍在使用 v0.6.0 等旧包名版本，请先在旧应用导出 JSON，再到当前应用恢复备份。

类型检查、单元 / 组件测试、完整浏览器回归、网页 / iOS 资源导出、Android Release 构建及 APK 验证均通过。
[原生验收](https://github.com/kitty191/bill/actions/runs/45006573649) 覆盖相同应用 / 构建输入；模拟器不代表真机帧率，iOS 导出不代表已生成 IPA。

SHA-256：`76ea101aad4790fef841fc3567db4cc386d66c85df6dd2d7ce487ef86e3205e5`

[APK 校验记录](qingzhang-v0.8.7-android-arm64-verification.json) · [自动发布验收记录](qingzhang-v0.8.7-android-arm64-validation.json) · [校验和](qingzhang-v0.8.7-android-arm64.apk.sha256)。
签名材料保留在私有构建环境。
