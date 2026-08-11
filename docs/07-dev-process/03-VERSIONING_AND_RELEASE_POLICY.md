# 版本与发布策略

## 1. 版本范围

项目在 `0.x` 阶段快速演进，但版本号仍表达风险：

- `0.MINOR.0`：新增能力、协议字段或明确的行为变化。
- `0.MINOR.PATCH`：不改变公开契约的修复、文档和测试更新。
- 任何破坏性变更：即使仍在 `0.x`，也必须提升 `MINOR`，并在 Release Notes 写出迁移步骤。

`v1.0.0` 的前提不是功能数量，而是共享包、服务端契约和首个生产数据迁移策略已经稳定。

## 2. 发布前检查

每个版本至少应完成：

1. `npm ci --no-audit --no-fund`
2. `npm run build`
3. `npm run verify:ci`
4. 若修改 Cocos 项目，在 Cocos Creator 3.8.8 中预览或构建，并执行 `npm run build:with-cocos`。
5. 更新 `CHANGELOG.md`，标明新增、修改、弃用、修复和安全影响。
6. 确认无密钥、真实域名、AppID、广告位或用户数据进入 Git 差异。

## 3. Tag 与 Release Notes

- Git Tag 使用 `vMAJOR.MINOR.PATCH`，例如 `v0.1.0`。
- Tag 必须指向通过公开 CI 的 `main` 提交。
- GitHub Release Notes 至少包含：适用范围、关键能力、已知限制、升级/配置要求和验证结果。
- 发布不等于部署。线上部署仍由私有 Variables / Secrets 和部署工作流控制。

## 4. 兼容性规则

- 配置、存档和 API 的新增字段必须可选或提供默认值。
- 存档变更必须提高 `schemaVersion` 并提供迁移函数。
- 已发布的 `gameKey` 不得重用或改作另一款游戏。
- 废弃接口先在 Release Notes 声明，在至少一个 `MINOR` 周期后再移除。
