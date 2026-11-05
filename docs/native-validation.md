# Android 原生验收

## 自动流程

`.github/workflows/checks.yml` 在代码推送和 PR 上执行锁文件安装、类型检查、单元测试、网页导出与 Chromium 回归；失败保留追踪和截图。

`.github/workflows/android-acceptance.yml` 构建历史 v0.6.1 与当前版本的 x86_64 独立 Release APK，在全新 API 35 模拟器上覆盖安装。编译使用 API 37（SDK 包名 `platforms;android-37.0`）、Build Tools 37.0.0、Java 21、NDK 27.1。两个包用同一枚临时测试密钥签名，不能用于更新正式预览版。原签名文件仍只保留在私有云环境。

`python3 scripts/ci_android_build.py --baseline v0.6.1-android-preview --output /tmp/acceptance-apks` 生成两份测试包；历史应用源码不改，只复用当前构建基础设施。

```sh
python3 scripts/native_acceptance.py \
  --baseline /tmp/acceptance-apks/baseline.apk \
  --candidate /tmp/acceptance-apks/candidate.apk \
  --output /tmp/native-report
```

该脚本只接受全新模拟器，拒绝真机和已有安装，不会清除用户手机数据。模拟器需要 adb root，以检查真实 SQLite、植入可重复的写入失败及事务延迟。覆盖安装核对财务账本、草稿和金额隐私偏好；操作实际计算器 / 备注键盘；验证写入失败后重试、保存事务中结束进程后的回滚；检查目录选择和文件备份在进程重启后仍可用。最后采集切页的 gfxinfo，保留 JSON、日志和截图。模拟器数据不能代表真机帧率或厂商键盘。

手动触发流程时，可通过 `reuse_build_run` 指定本仓库已有的测试包构建运行。脚本核对历史基线、应用与构建输入的 Git 差异及 APK SHA-256，应用输入改变时拒绝复用；仅修改验收脚本时可直接重跑模拟器。

自动运行结果见 [本轮审查](review-v0.7.0.md)。没有成功运行的步骤不会记作通过。

## 真机性能采集

本轮云环境没有连接真机，无法给出实际 60 / 120 Hz 流畅度结论。在安装原签名预览包的 Android 开发机器上，可运行：

```sh
python3 scripts/native_profile.py --serial DEVICE_SERIAL --seconds 20 --output /tmp/qingzhang-profile.json
```

采集期间手动完成冷启动后的页面滑动、加号、计算器和列表操作。脚本只重置 / 读取图形统计与设备型号信息，不安装应用、清除数据或读取账本，也不自动截图。它不能替代现场观察中文键盘、安全区、大字体、触感和玻璃材质。

iOS 已验证资源 / Hermes 导出，不代表原生文件授权或键盘验收通过；IPA 仍需 macOS 和 Apple 签名。
