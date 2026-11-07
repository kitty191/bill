# 清账 Android 预览版

[下载 v0.8.0 APK](https://github.com/kitty191/bill/raw/refs/tags/v0.8.0-android-preview/downloads/qingzhang-v0.8.0-android-arm64.apk) · [版本说明](https://github.com/kitty191/bill/releases/tag/v0.8.0-android-preview)

版本 0.8.0 / versionCode 21，32,845,395 字节，约 31.3 MB。
ARM64、Android 7.0+，独立安装包；沿用 v0.7.0 原签名，可直接覆盖安装，无需卸载。

加入 Android 系统后台文件备份，并将原签名预览版发布流程自动化。

- 在“设置 → 隐私与备份提醒”选择目录和频率后，可单独打开“允许系统后台备份”。默认关闭，旧版本升级不会自动打开。
- 系统可在应用离开前台、缓存进程被回收后唤起备份；首次启用后的系统执行会生成首份后台备份，之后按所选频率到期执行。写入并回读校验后才记录成功，设置显示最近后台成功时间，保留七份有效版本。
- 前台、手动和后台备份共用互斥控制；进程中断后可回收过期任务，过期写入者不能清理文件或覆盖新设置。关闭自动备份会取消后台任务，过期已排队任务也会检查开关。
- 修复网页一次快速甩动跨过两页的问题；单次触摸最多切换一页，取消图表探索后仍可正常切页，dock 点击可立即打断惯性。手机端保持原生分页。
- 一键发布脚本自动检查、构建、核对原签名、提交推送、创建预览版本，并完整下载核验 APK。原密钥继续留在私有构建环境；只有与本版应用 / 构建输入一致的原生 CI 通过后才允许发布。

后台执行时间由 Android 安排，受省电和网络状态影响；系统“强行停止”后需重新打开应用，不能保证固定时刻执行。备份文件不加密、不自动上传。iOS 与网页继续使用前台备份；尚无可下载 IPA。

沿用原签名，可直接覆盖安装，账本 schema 保持 4。

类型检查、232 项单元 / 组件测试、79 项完整浏览器回归、网页 / iOS 资源导出、Android Release 构建及 APK 验证均通过。
[原生验收](https://github.com/kitty191/bill/actions/runs/42372029265) 覆盖相同应用 / 构建输入，包含缓存进程回收后的后台唤醒备份；模拟器不代表真机帧率，iOS 导出不代表已生成 IPA。

SHA-256：`5d4c0a0d56555e7dac6c2c7f2b459b89ed0313fe0c0a1dedb78e33cd0686e893`

[APK 校验记录](qingzhang-v0.8.0-android-arm64-verification.json) · [自动发布验收记录](qingzhang-v0.8.0-android-arm64-validation.json) · [校验和](qingzhang-v0.8.0-android-arm64.apk.sha256)。
签名材料保留在私有构建环境。
