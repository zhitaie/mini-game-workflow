# Contributing

感谢参与。本仓库首先保证“共享能力与具体游戏玩法分离”，其次才是增加功能。

## 开始之前

1. 阅读 [README.md](README.md) 并完成本地启动。
2. 在提交前确认需求属于共享包、API 服务、管理端，还是某一个游戏。
3. 不要提交生产域名、AppID、广告位 ID、密码、令牌、私钥、玩家数据或 Cocos 本机生成目录。

## 开发边界

- `packages/` 只能放可复用、与具体玩法和页面无关的能力。
- `apps/<game>/` 放该游戏的规则、UI、美术和平台配置。
- `services/` 负责服务端能力，不应直接依赖某款游戏的展示逻辑。
- 新增跨游戏字段、接口或配置前，先补充相应文档和迁移方案。

## 提交前验证

```bash
npm run build
npm run verify:minimal
npm run verify:dev-stack
npm run verify:persistence
```

修改 `apps/ski-endless/client` 时，还应使用 Cocos Creator 3.8.8 完成预览或构建；编辑器导入完成后可运行 `npm run build:with-cocos`。

## 提交 Pull Request

- 一个 PR 聚焦一个可验证的问题，说明边界和兼容性影响。
- 提供实际执行过的验证命令与结果。
- 有行为变化时更新 README、`docs/` 或 CHANGELOG。
- 不要为了“复用”提前抽象；至少有两个明确的调用点再抽到共享层。
