# 清账 Android 预览版

[下载 v0.1.4 APK](https://github.com/kitty191/bill/raw/refs/heads/main/downloads/qingzhang-v0.1.4-android-arm64.apk) · [版本说明](https://github.com/kitty191/bill/releases/tag/v0.1.4-android-preview)

- 版本：0.1.4，versionCode 5，31,601,406 字节，约 30 MB。
- 首页账户卡片与总资产默认隐藏，可在「设置 → 首页显示 → 首页显示账户卡片」中打开或关闭；选择会保存，关闭不删除账户或账单。
- 修复滑动与 dock 方向不一致：手指向右滑动，首页进入账单，再进入统计，页面与 dock 指示器同步向右；手指向左滑动返回。各页保留滚动位置。
- 每日支出改为折线图，轻触查看当天金额，支持浅色和深色模式。
- 沿用深绿账本与叶片桌面图标，签名与之前的版本一致，可以直接覆盖安装，保留已有账本，不需要卸载旧版，也不需要先安装 v0.1.3。
- 设备：ARM64 系统，Android 7.0 / API 24 及以上。此包不支持 32 位系统或 x86 模拟器。
- 独立 APK，内含应用代码，不需要 Expo Go 或连接开发服务器。
- 首次启动为空账本，可在设置中主动载入示例。

下载后使用系统安装器打开，按系统提示允许当前来源安装。数据保存在本机，请在卸载前从应用设置导出 JSON 备份。

APK 使用仓库外保存的私有预览密钥签名，已通过 APK v2 签名、ZIP CRC 与 16 KB ZIP 对齐检查。还没有进行真机验收。IPA 需要额外的 Apple 构建和签名条件，目前没有可下载的 iOS 安装包。

SHA-256：

```text
8d750b37b8ab1535e23813e3d3e4780df2080ced7a1d2daf8e74b171683b353a
```

完整信息见 [构建校验记录](qingzhang-v0.1.4-android-arm64-verification.json)。APK 和 [校验和文件](qingzhang-v0.1.4-android-arm64.apk.sha256) 已保存在此目录；签名密钥不会上传。旧版的安装包和校验记录保留供追溯。
