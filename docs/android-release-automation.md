# 原签名 Android 预览版自动发布

私有构建环境使用原有签名配置，单条命令完成检查、构建、验证、提交和公开下载核验：

```sh
QINGZHANG_SIGNING_CONFIG=/path/to/existing/private-signing.json \
  python3 scripts/release_android.py --wait-native-minutes 60
```

开始前提交审查后的代码和 `docs/release-v版本.md`，保证 main 工作目录干净、版本和 versionCode 递增。脚本不会生成新签名，不会复制或上传签名文件，不读取机器全局 Git 身份。

流程执行 TypeScript、全部单元 / 组件测试、网页导出、完整浏览器交互回归、iOS 资源导出、ARM64 Release 构建和 APK 校验。原生 GitHub Actions 必须已成功验收相同应用 / 构建输入；仅文档与验收基础设施不同可复用原生结果。证书必须与上一预览版一致，版本、CRC、16 KB 对齐、架构、内置代码和 SHA-256 均检查通过。

随后只提交 APK、校验和、校验 / 验收 JSON 和下载说明这些生成文件，Author 为 kitty191、Committer 为 Codex，并保留 Codex 联合作者尾注。普通推送失败即停止，不强推；创建预览 Release 后完整匿名下载带版本标签的 APK，核对字节数与 SHA-256。任何步骤失败均不会伪报发布成功，日志保留在打印出的临时目录。

可拆成两个阶段：

```sh
QINGZHANG_SIGNING_CONFIG=/path/to/existing/private-signing.json \
  python3 scripts/release_android.py --prepare-only --wait-native-minutes 60
python3 scripts/release_android.py --publish-prepared
```

第二阶段严格复核已准备的 APK、完整检查回执和源码差异，不跳过验收或更换签名。它也可在推送 / 创建 Release / 下载中断后恢复，复用已经完成的检查和构建。

这是可在现有私有构建机运行的一键流程。当前集成没有 GitHub Secrets 与 Runner 管理权限（API 返回 403），没有启用 GitHub 上常驻、无人值守的原签名发布，也没有将私钥迁入仓库。常驻自动触发需另行配置长期在线的私有构建服务；不可把生产签名暴露给公开 PR 的构建任务。
