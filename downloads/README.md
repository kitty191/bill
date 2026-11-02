# 清账 Android 预览版

[下载 APK](https://github.com/kitty191/bill/raw/refs/heads/main/downloads/qingzhang-v0.1.0-android-arm64.apk) · [版本说明](https://github.com/kitty191/bill/releases/tag/v0.1.0-android-preview)

- 版本：0.1.0，versionCode 1，约 30 MB。
- 设备：ARM64 系统，Android 7.0 / API 24 及以上。此包不支持 32 位系统或 x86 模拟器。
- 独立 APK，内含应用代码，不需要 Expo Go 或连接开发服务器。
- 首次启动为空账本，可在设置中主动载入示例。

下载后使用系统安装器打开，按系统提示允许当前来源安装。数据保存在本机，请在卸载前从应用设置导出 JSON 备份。

APK 使用仓库外保存的私有预览密钥签名，已通过 APK v2 签名、ZIP CRC 与 16 KB ZIP 对齐检查。还没有进行真机验收。IPA 需要额外的 Apple 构建和签名条件，目前没有可下载的 iOS 安装包。

SHA-256：

```text
630ace564e5983b7392c682c68d2f5ab4d5d185856d609632097442b50731bab
```

完整信息见 [构建校验记录](qingzhang-v0.1.0-android-arm64-verification.json)。APK 和 [校验和文件](qingzhang-v0.1.0-android-arm64.apk.sha256) 已保存在此目录；签名密钥不会上传。
