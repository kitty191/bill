# Android 预览包构建

应用包名：`com.kitty191.qingzhang`。构建 `release` 变体并内置 JS / Hermes 代码，不依赖 Metro 或 Expo Go。默认只编译 ARM64，面向使用 ARM64 系统的 Android 手机。

## 工具链

- Node.js 24、npm 11、Python 3。
- JDK 21 运行 Gradle，另需 JDK 17 编译 React Native 自带的 Gradle 插件（都需要完整 JDK，只有 JRE 不足以编译）。
- Android SDK Platform 37.0、Build Tools 37.0.0、NDK 27.1.12297006、CMake 3.22.1 / 3.30.5。
- Gradle 9.4.1，通过生成工程的 Gradle Wrapper 使用。

在本云环境中，工具安装于 `/workspace/shared/qingzhang-toolchains`，JDK / Gradle 从官方地址下载并验证 SHA-256，Android SDK 使用 Google 官方工具与仓库。API 37 的实际 SDK 包名为 `platforms;android-37.0`，不能使用已不存在的 `platforms;android-37`。

## 签名

Android 安装包需要签名。预览版使用单独的私有签名密钥，保存在仓库之外：`/workspace/shared/qingzhang-signing/`。它不是 Google Play 发布密钥；密钥和密码均不应提交到 Git。后续要覆盖安装、保留已有数据，必须沿用同一签名密钥。

`QINGZHANG_SIGNING_CONFIG` 指向仓库外的私密 JSON 文件，其字段为 `keystore`（密钥文件绝对路径）、`storePassword`、`keyPassword` 和 `alias`。请通过本地安全配置提供真实值，不能填入源代码、命令参数或公共文档。

## 构建

在已有上述工具和签名配置的机器上运行：

```sh
npm ci
export JAVA_HOME=/path/to/jdk-21
export ANDROID_HOME=/path/to/android-sdk
export QINGZHANG_SIGNING_CONFIG=/secure/path/preview-signing.json
npm run build:apk
```

本云环境的脚本可发现保留的 JDK / SDK，仅需指定已有签名配置路径。脚本运行 Expo prebuild、编译 ARM64 Release，并复制 APK 和 SHA-256 文件到 `downloads/`。生成的 `android/` 目录被 Git 忽略；源配置为 `app.json`、锁文件与 `scripts/`。

构建使用仓库外的签名配置，覆盖 Expo 模板的默认 Debug 签名。脚本保留继承的代理与 TLS 校验；如使用预下载 Gradle 压缩包，会先核对保存的官方 SHA-256。

初始受限网络无法访问 JitPack。Expo Blur 依赖的 BlurView 3.1.0 因此从官方 GitHub 固定提交核实后保存在 `native-deps/blurview/`，构建脚本仅将这个版本替换为本地模块。Java 和资源文件未修改，来源与许可证见该目录的 `UPSTREAM.md`；许可证同时打入 APK。构建无需访问 JitPack，也没有关闭 TLS 或更改依赖校验值。

应用使用 SDK 映射的 `react-native-pager-view` 9.0.7，预构建会自动链接其 Android 原生模块；构建时将其 MIT 许可证打入 APK。构建后执行 `python3 scripts/verify_android.py`，检查当前版本、原签名、原生分页代码、内置资源与完整性，并确认临时性能计数器未进入安装包。

React Native 0.88.1 的 Maven 原生 AAR 会重定向到 `repo.reactnative.dev`。受限网络需要允许该官方域名；只允许 Maven Central 不足以完成下载。初次编译曾被 403 策略拒绝，调整联网设置后实际下载恢复，ARM64 Release 构建已成功。

预览包、SHA-256 与校验记录保存在仓库 `downloads/`，Release 页面提供下载入口。签名和 16 KB ZIP 对齐、ZIP 完整性、包名、架构、内置 Hermes 代码均已校验；尚未进行真机安装测试。私有签名文件始终保存在仓库之外。

v0.2.0 另外自动链接 `expo-local-authentication` 与 `expo-secure-store`。Android 通过系统生物识别接口验证，隐私偏好保存在 SecureStore；iOS 配置 Face ID 用途说明。它们均需独立构建，不能用网页回归替代原生认证验收。

## iOS

可安装 IPA 需要 macOS / Xcode 或远程 iOS 构建服务，以及匹配的 Apple 签名证书和分发描述文件。当前 Linux 环境没有这些能力，也没有登录 Expo 远程构建服务。不能将未签名的 `.app` 或模拟器产物重命名为 `.ipa` 当作可安装包分发。
