# 工作区结构

## 1. 推荐结构

```text
mini-game-workflow/
├─ apps/
│  ├─ game-foo/
│  │  ├─ client/
│  │  ├─ game.config.ts
│  │  └─ README.md
│  └─ game-bar/
│     ├─ client/
│     ├─ game.config.ts
│     └─ README.md
├─ packages/
│  ├─ game-core-client/
│  ├─ game-core-types/
│  ├─ game-core-config/
│  └─ game-core-utils/
├─ services/
│  ├─ api-server/
│  └─ admin-web/
├─ scripts/
├─ sql/
└─ docs/
```

## 2. 每一层放什么

### 2.1 `apps/`

这里放具体游戏。

每个游戏目录只放：

- 游戏客户端入口
- 游戏玩法逻辑
- 游戏资源
- 游戏专属 UI
- 游戏接入配置

这里不放：

- 一整套独立后端
- 一整套独立后台
- 可以抽到共享层的公共基础设施

补充说明：

- 如果某款游戏使用 `Cocos Creator`，`apps/<game>/client/` 可以直接是 Cocos 项目根目录。
- 此时场景、Prefab、资源、脚本都属于该游戏自己的客户端实现，仍然不应反向污染 `packages/`。
- `apps/<game>/game.config.ts` 继续保留在游戏根目录，用来描述接入声明，而不是放到 Cocos 资源目录里。

### 2.2 `packages/`

这里放共享能力。

建议首期只放真正稳定的基础包：

- `game-core-client`
- `game-core-types`
- `game-core-config`
- `game-core-utils`

注意：

- 共享包不应该知道任何具体游戏名。
- 共享包不应该依赖某款游戏的资源或玩法数据。
- 共享包的设计目标是稳定，不是模块越多越好。

### 2.3 `services/`

这里放所有游戏共用的服务端和后台。

- `api-server`：认证、配置、存档、埋点、公告，以及少量按 `gameKey` 扩展的游戏专属模块。
- `admin-web`：按 `gameKey` 管理配置、用户、公告、日志等。

原则：

- 共用服务端是主线。
- 游戏专属服务逻辑，优先作为 `api-server` 内部模块扩展。
- 不为每个游戏单独再起一整套服务端，除非被真实规模证明有必要。

## 3. 首期共享客户端核心包建议

`packages/game-core-client/` 首期建议包含：

- `platform/`
- `network/`
- `storage/`
- `config/`
- `analytics/`
- `ad/`

可先保留轻量占位或后置的：

- `reward/`
- `audio/`
- `ui/`

这里的关键不是模块数量，而是边界清楚。

## 4. `game.config.ts` 的职责

每个游戏都应有自己的 `game.config.ts`。

它至少定义：

- `gameKey`
- `gameName`
- 启用的平台
- 启用的功能模块
- 配置空间标识
- 广告场景映射

它的作用是：

- 让平台知道“这是哪一个游戏”
- 让共享层知道“这个游戏启用了哪些能力”
- 让构建脚本知道“应该如何构建与发布这个游戏”

补充说明：

- `game.config.ts` 属于接入声明，不属于后台可随意修改的运行时配置。
- `features` 只声明“这个游戏有没有接这个模块”，不声明“这个模块当前怎么运行”。
- 广告开关、奖励倍率、活动状态等运行参数，应放到远程配置里，而不是放到 `game.config.ts` 里。

## 5. 为什么这个结构能减少返工

因为它把变化隔离开了：

- 玩法变化，大多只在 `apps/<game>/client/`
- 共享能力变化，大多只在 `packages/`
- 服务端公共能力变化，大多只在 `services/api-server/`
- 游戏管理变化，大多只在 `services/admin-web/`

如果边界守得住，新增第二个游戏时，不应该再回头改第一个游戏的玩法代码。

## 6. Cocos 接入时的特殊约束

如果某款游戏采用 `Cocos Creator`：

- `apps/<game>/client/assets/`、`settings/`、`extensions/` 归该游戏自己管理
- `packages/game-core-client/` 继续只放引擎无关的共享 runtime 能力
- 如有必要，可后续新增很薄的 `packages/game-core-cocos/`，专门处理引擎桥接

必须避免：

- 在 `packages/` 中直接写具体场景脚本或 Prefab 逻辑
- 让服务端接口因为 Cocos 接入而改变协议形状
- 为了第一款游戏把 `game-sample` 直接替换掉
