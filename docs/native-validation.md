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

自动运行结果见 [本轮审查](review-v0.8.0.md)。没有成功运行的步骤不会记作通过。

## 真机性能采集

本轮云环境没有连接真机，无法给出实际 60 / 120 Hz 流畅度结论。在安装原签名预览包的 Android 开发机器上，可运行：

```sh
python3 scripts/native_profile.py --serial DEVICE_SERIAL --seconds 20 --output /tmp/qingzhang-profile.json
```

采集期间手动完成冷启动后的页面滑动、加号、计算器和列表操作。脚本只重置 / 读取图形统计与设备型号信息，不安装应用、清除数据或读取账本，也不自动截图。它不能替代现场观察中文键盘、安全区、大字体、触感和玻璃材质。

iOS 已验证资源 / Hermes 导出，不代表原生文件授权或键盘验收通过；IPA 仍需 macOS 和 Apple 签名。

## v0.8 后台任务验收

在全新 API 35 模拟器中显式开启后台开关，确认系统 WorkManager 作业已注册。返回桌面后使用 `am kill` 回收缓存进程（不使用会禁止后台任务的 `am force-stop`），再用 Android JobScheduler 强制触发已注册作业，核对后台生成的新 JSON 与已提交账本一致、最近后台成功时间可见，以及开关关闭。强制触发仅用于加速验收，不代表真实设备会按固定时刻调度。

开关定位优先选择真正可交互的节点，核对 checked 状态变化；任务识别兼容旧版 `JOB #uid/id` 与 API 35 的 `JOB namespace:uid/id`，通过对应命名空间触发本应用的 WorkManager 作业，不误选其他应用或服务。

目录授权的干净重启检查等待当前文件名已记录成功、操作控件恢复空闲；仅有可读取文件不代表备份任务已完成。后台检查确认缓存进程真的消失、新进程生成有效备份，再直接打开界面核对成功时间，避免 force-stop 打断备份末尾的状态持久化与清理。真实备份中断后的租约最多 30 分钟后回收；不将干净重启检查描述为中途强杀备份的即时恢复。

Android 输入比较只额外忽略已有、未改变 `.native.tsx` 实现所覆盖的网页 `SwipePager.tsx`；原生实现被修改 / 删除及其他源码、依赖、配置、构建输入改变都会拒绝复用。
