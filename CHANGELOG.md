# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 的记录方式，并使用语义化版本。

## [Unreleased]

## [0.1.0] - 2026-08-11

### Added

- 多游戏 monorepo 基础结构和架构文档。
- 共享游戏类型、客户端网络/存档能力与可配置 API 服务。
- 本地 SQLite 开发持久化、管理端认证和审计模型。
- 浏览器样例客户端及 Cocos Creator 3.8.8 滑雪样例。
- Docker 化 API 服务和可选的 GitHub Actions 部署工作流。
- Apache-2.0 许可证、贡献规范、安全披露说明、Issue/PR 模板和公开路线图。
- 公开 CI、完整验证入口、版本策略和 API 服务运行手册。

### Changed

- 根构建只验证可复现的 Node.js 工作区；Cocos 校验改为显式的本地编辑器步骤。
- 未配置私有部署 Variables 的公开 fork 会跳过部署，而不会使公共验证失败。
- 私密聊天记录不再纳入 Git 当前版本。
