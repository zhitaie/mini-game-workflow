# SaveManager 规范

## 1. 目标

`SaveManager` 是平台最容易引发后续返工的模块之一。

它如果被设计成“帮第一款游戏存金币和关卡”的工具，第二款游戏大概率就要推翻重来。

所以它的职责必须限定为：

- 管理存档生命周期
- 管理 schema 版本
- 管理默认值与迁移
- 提供稳定的读写接口

它不负责：

- 定义具体资源字段
- 决定奖励逻辑
- 决定玩法状态机

## 2. 设计原则

### 2.1 按游戏隔离

每个游戏都必须有独立的存档命名空间。

示意：

```ts
type SaveNamespace = string;
```

### 2.2 有 schema 版本

每份存档都必须带版本号。

示意：

```ts
export interface SaveEnvelope<TData> {
  schemaVersion: number;
  data: TData;
  updatedAt: number;
}
```

### 2.3 支持默认值工厂

每个游戏必须提供自己的默认存档，而不是由共享层写死。

示意：

```ts
export interface SaveDefinition<TData> {
  namespace: string;
  latestVersion: number;
  createDefault: () => TData;
  migrations: Record<number, (data: unknown) => TData>;
}
```

这里的 `migrations` 建议理解为：

- key 是历史 `schemaVersion`
- value 负责把该历史版本数据规范化为当前最新的 `TData`

也就是说，`SaveManager` 在初始化时最终总是把历史数据收敛到最新 schema。

### 2.4 支持迁移

迁移是平台长期稳定的关键。

含义是：

- 老版本存档可以继续被读取
- 缺失字段可以被补齐
- 新字段不需要强迫旧游戏立刻重做

## 3. 推荐接口

```ts
export interface SaveManager<TData> {
  init(): Promise<void>;
  getAll(): Readonly<TData>;
  get<TValue>(selector: (data: TData) => TValue): TValue;
  update(mutator: (draft: TData) => void): void;
  replace(nextData: TData): void;
  markDirty(): void;
  saveNow(): Promise<void>;
  exportEnvelope(): SaveEnvelope<TData>;
}
```

更推荐通过工厂创建实例：

```ts
export function createSaveManager<TData>(
  definition: SaveDefinition<TData>,
): SaveManager<TData>;
```

这个设计的关键在于：

- 一个 `SaveManager` 实例只绑定一个明确的 `TData`
- 一个经营游戏的存档 manager 不能再被拿去当射箭游戏的存档 manager
- 类型、默认值、迁移规则从创建时就一起绑定

## 4. 为什么不推荐首期做成 key-value 风格

下面这种接口看起来简单，但中长期风险高：

```ts
SaveManager.get('gold');
SaveManager.set('gold', 100);
```

问题是：

- 它默认假设共享层知道字段结构
- 字段演进时很难做类型约束
- 复杂嵌套结构更新会越来越混乱

更推荐的方向是：

- 由每个游戏定义自己的存档 schema
- `SaveManager` 只负责存档容器、迁移、持久化
- 一个 manager 实例只服务于一份 schema

## 5. 存档演进示例

假设 `v1` 没有 `offlineIncome` 字段，`v2` 需要新增它。

示意：

```ts
const saveDefinition = {
  namespace: 'sim_business',
  latestVersion: 2,
  createDefault: () => ({
    gold: 0,
    level: 1,
    offlineIncome: 0,
  }),
  migrations: {
    1: (oldData) => ({
      ...(oldData as Record<string, unknown>),
      offlineIncome: 0,
    }),
  },
};
```

这样新增字段时，不需要回头修改旧游戏逻辑，只需要补迁移。

## 6. 单实例绑定单 schema 的含义

这条规则必须明确：

- `gameA` 应该创建自己的 `SaveManager<GameASave>`
- `gameB` 应该创建自己的 `SaveManager<GameBSave>`
- 不存在“同一个 manager 实例同时管理多种存档结构”的设计

这样做的作用是：

- 避免类型漂移
- 避免接口被迫退化成 `unknown` 或 `any`
- 让迁移与默认值始终和同一份 schema 对齐

## 7. 必须避免的错误设计

- 共享层直接写死 `gold`、`diamond`、`energy`
- 所有游戏共用一个固定存档结构
- 没有 schema 版本
- 改结构时直接覆盖旧存档
- 把奖励发放逻辑写进 `SaveManager`
- 一个实例同时承担多个不同 schema

## 8. 首期实现建议

首期即使只做本地存档，也建议预留：

- 本地存储适配层
- 云存档同步接口位
- 迁移函数机制
- 存档 envelope 结构
- 创建时绑定 schema 的工厂函数

这样后面补云存档时，不需要推翻本地存档设计。
