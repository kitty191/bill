# 清账新版 Android 更新

清账新版使用 `com.kitty191.qingzhang.app`，v0.8.2 的 `versionCode` 为 23。签名材料由私有构建环境保管。保留一份独立的加密密钥备份和最近一次已分发的 APK，后续更新需要沿用原签名。

在安装好 JDK 和 Android SDK 的私有构建环境，用同一份 `QINGZHANG_SIGNING_CONFIG` 构建：

```sh
python3 scripts/prepare_android_update.py --previous /path/to/distributed.apk --output /path/to/new-output
```

脚本核对包名、原签名、Android 兼容性、版本递增、桌面快捷入口、包完整性和 16 KB 对齐，再输出 APK、SHA-256 和验收记录。已有完整原生构建可附 `--verify-only /path/to/candidate.apk` 复核。快捷入口和加密依赖新的原生资源或模块，因此这个版本需要完整的原生构建。

在备用 Android 真机上完成交付验收：

1. 安装步骤中的上一版 APK，建立含收支、转账和退款的测试账本，导出一份备份。
2. 直接安装候选 APK，检查升级后账单、账户余额、预算以及常用筛选。长按桌面图标，验证支出和收入入口与应用锁。
3. 导出加密备份，验证错误密码会被拒绝。再用正确密码预览并确认恢复测试账本，检查金额和关联退款。
4. 记录设备型号、Android 版本、候选 SHA-256 和各项结果，随交付保留。本流程仅在备用设备使用测试账本。

旧版 `com.kitty191.qingzhang` 的发布历史继续保留。使用旧版的账本可以通过导出和恢复 JSON 迁移到清账新版。
