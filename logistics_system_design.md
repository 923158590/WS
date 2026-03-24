# Minecraft 物流系统技术设计方案

> **项目代号**: OpenClaw Logistics System
> **版本**: v1.0
> **日期**: 2026-03-23
> **状态**: 设计阶段

---

## 1. 系统概述

### 1.1 项目目标
基于 Mineflayer 框架构建一套独立的物流自动化系统，接收 OpenClaw 指令并控制多个 Minecraft 机器人协同工作，实现物品的自动收集、分类、存储和调度。

### 1.2 设计原则
- **独立性**: 完全独立于 BProtocol 系统，并行支线项目
- **持久性**: 机器人创建后持续运行,直到服务器关闭
- **模块化**: 各职业机器人职责明确,可独立扩展
- **指令驱动**: 接收 OpenClaw 指令作为任务来源

---

## 2. 系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      OpenClaw 指令层                         │
│                  (任务生成与调度中心)                         │
└───────────────────────────┬─────────────────────────────────┘
                            │ gRPC / WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Logistics Controller                       │
│              (Node.js 指令接收与任务分发)                     │
├─────────────────────────────────────────────────────────────┤
│  Task Queue  │  Robot Manager  │  Warehouse Manager          │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Scavengers   │   │ Warehousers  │   │ Builders     │
│  (拾荒者)    │   │  (仓库员)    │   │  (建筑师)    │
├──────────────┤   ├──────────────┤   ├──────────────┤
│ - 收集物品   │   │ - 管理仓库   │   │ - 获取材料   │
│ - 运送到    │   │ - 分类调度   │   │ - 建造结构   │
│   输入仓库  │   │ - 库存监控   │   │ - 任务执行   │
└──────────────┘   └──────────────┘   └──────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
              ┌─────────────────────────┐
              │   Minecraft Server      │
              │   (物品存储与交互)       │
              └─────────────────────────┘
```

### 2.2 仓库层级结构

```
┌──────────────────────────────────────────────────────────┐
│                     物流仓库网络                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐      ┌──────────────────────┐        │
│  │ Input Ware-  │ ───▶ │  Sorting Warehouse   │        │
│  │ house        │      │  (分类仓库)          │        │
│  │ (输入仓库)   │      │                      │        │
│  │              │      │  - 按物品类型分类    │        │
│  │ - 原始存储   │      │  - 临时缓冲区        │        │
│  │ - 无需分类   │      │  - 智能分拣          │        │
│  └──────────────┘      └──────────┬───────────┘        │
│                                    │                     │
│                                    ▼                     │
│                         ┌──────────────────────┐        │
│                         │  Output Warehouse    │        │
│                         │  (输出仓库)          │        │
│                         │                      │        │
│                         │  - 建造材料存储      │        │
│                         │  - 按需调度          │        │
│                         │  - 建筑师接口        │        │
│                         └──────────────────────┘        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 3. 机器人角色设计

### 3.1 拾荒者 (Scavenger)

**职责**:
- 探索世界收集掉落物品
- 挖掘指定资源
- 从已有箱子中收集物品
- 将物品运送到输入仓库

**核心能力**:
```javascript
class ScavengerBot {
  // 收集地面掉落物
  collectDroppedItems(radius);

  // 挖掘指定方块
  mineBlocks(blockType, count, position);

  // 从箱子取物品
  extractFromChest(chestPosition, itemType);

  // 运送到输入仓库
  depositToInputWarehouse(items);

  // 路径规划与导航
  navigateTo(target);
}
```

**任务示例**:
```javascript
{
  type: "scavenge",
  target: "oak_log",
  quantity: 64,
  source: "mining", // mining | dropped | chest
  sourcePosition: {x: 100, y: 64, z: 200},
  depositTo: "input_warehouse_1"
}
```

### 3.2 仓库员 (Warehouser)

**职责**:
- 管理所有仓库的库存
- 执行物品分类任务
- 在仓库间调度物品
- 监控库存水平并报告

**核心能力**:
```javascript
class WarehouserBot {
  // 从输入仓库取物品
  retrieveFromInput(warehouseId, items);

  // 分类并放入分类仓库
  sortAndDeposit(items, sortingWarehouse);

  // 调度到输出仓库
  dispatchToOutput(sortingWarehouse, outputWarehouse, items);

  // 库存查询
  checkInventory(warehouseId, itemType);

  // 箱子操作
  depositToChest(chestPosition, items);
  withdrawFromChest(chestPosition, items);
}
```

**任务示例**:
```javascript
{
  type: "sort_and_dispatch",
  source: {
    warehouse: "input_warehouse_1",
    items: ["all"]
  },
  sorting: {
    warehouse: "sorting_warehouse_1",
    strategy: "by_type" // by_type | by_id | custom
  },
  destination: {
    warehouse: "output_warehouse_1",
    items: ["oak_log", "stone", "cobblestone"]
  }
}
```

### 3.3 建筑师 (Builder)

**职责**:
- 从输出仓库获取建造材料
- 执行建造任务
- 报告材料需求

**核心能力**:
```javascript
class BuilderBot {
  // 获取建造材料
  requestMaterials(materials, outputWarehouse);

  // 执行建造指令
  buildStructure(blueprint, startPosition);

  // 放置方块
  placeBlock(blockType, position);

  // 材料检查
  checkMaterialAvailability(requiredMaterials);
}
```

**任务示例**:
```javascript
{
  type: "build",
  blueprint: "house_v1.json",
  position: {x: 0, y: 64, z: 0},
  materials: {
    "oak_planks": 192,
    "cobblestone": 64,
    "glass": 32
  },
  sourceWarehouse: "output_warehouse_1"
}
```

---

## 4. 仓库管理系统

### 4.1 输入仓库 (Input Warehouse)

**功能特点**:
- **无分类存储**: 接收所有物品,不进行分类
- **高吞吐量**: 设计为快速存取,减少拾荒者等待
- **大容量**: 使用多个箱子组合存储

**数据结构**:
```javascript
{
  warehouseId: "input_warehouse_1",
  type: "input",
  location: {x: 0, y: 64, z: 0},
  chests: [
    {id: "chest_1", position: {x: 0, y: 64, z: 0}, items: []},
    {id: "chest_2", position: {x: 2, y: 64, z: 0}, items: []}
  ],
  totalCapacity: 27 * 54, // 27 slots * 64 stack max * 54 chests
  currentLoad: 0
}
```

**管理规则**:
- 拾荒者可将任意物品放入任意空箱子
- 仓库员定期清空并转移到分类仓库
- 空闲时保持低库存以避免堆积

### 4.2 分类仓库 (Sorting Warehouse)

**功能特点**:
- **智能分拣**: 按物品类型/ID/用途分类
- **缓冲区管理**: 临时存储待调度物品
- **优先级队列**: 重要物品优先调度

**分类策略**:
```javascript
const SORTING_STRATEGIES = {
  by_type: {
    categories: {
      "wood": ["oak_log", "birch_log", "spruce_log"],
      "stone": ["stone", "cobblestone", "andesite"],
      "ores": ["coal_ore", "iron_ore", "gold_ore"],
      "food": ["wheat", "carrot", "potato"],
      "tools": ["wooden_pickaxe", "stone_pickaxe"]
    }
  },
  by_id: {
    // 直接按物品ID分类
  },
  custom: {
    // 自定义分类规则
  }
};
```

**数据结构**:
```javascript
{
  warehouseId: "sorting_warehouse_1",
  type: "sorting",
  location: {x: 10, y: 64, z: 0},
  categories: {
    "wood": {chestId: "chest_1", items: [], capacity: 1728},
    "stone": {chestId: "chest_2", items: [], capacity: 1728},
    "ores": {chestId: "chest_3", items: [], capacity: 1728}
  },
  sortingStrategy: "by_type"
}
```

### 4.3 输出仓库 (Output Warehouse)

**功能特点**:
- **按需分配**: 根据建筑师需求提供材料
- **预测缓存**: 预加载常用建造材料
- **库存监控**: 实时报告材料可用性

**数据结构**:
```javascript
{
  warehouseId: "output_warehouse_1",
  type: "output",
  location: {x: 20, y: 64, z: 0},
  materials: {
    "oak_planks": {
      chestId: "chest_1",
      quantity: 192,
      reserved: 64, // 已被建筑师预订
      available: 128
    },
    "cobblestone": {
      chestId: "chest_2",
      quantity: 256,
      reserved: 0,
      available: 256
    }
  },
  requests: [
    {builderId: "builder_1", materials: {}, status: "pending"}
  ]
}
```

---

## 5. 指令系统

### 5.1 OpenClaw 指令接口

**通信协议**: gRPC / WebSocket

**指令格式**:
```javascript
{
  timestamp: 1711234567890,
  taskId: "task_20260323_001",
  command: "logistics_operation",
  payload: {
    operation: "collect_and_build",
    priority: 1, // 0=low, 1=normal, 2=high
    steps: [
      {
        role: "scavenger",
        botId: "scavenger_1",
        action: "collect",
        params: { /* 拾荒者参数 */ }
      },
      {
        role: "warehouser",
        botId: "warehouser_1",
        action: "sort_and_dispatch",
        params: { /* 仓库员参数 */ }
      },
      {
        role: "builder",
        botId: "builder_1",
        action: "build",
        params: { /* 建筑师参数 */ }
      }
    ]
  }
}
```

### 5.2 指令类型

#### 5.2.1 收集指令
```javascript
{
  type: "collect",
  target: "oak_log",
  quantity: 64,
  method: "mining", // mining | collecting | extracting
  location: {x: 100, y: 64, z: 100},
  depositTo: "input_warehouse_1"
}
```

#### 5.2.2 分类指令
```javascript
{
  type: "sort",
  source: "input_warehouse_1",
  destination: "sorting_warehouse_1",
  strategy: "by_type",
  items: ["all"] // 或指定物品 ["oak_log", "stone"]
}
```

#### 5.2.3 调度指令
```javascript
{
  type: "dispatch",
  source: "sorting_warehouse_1",
  destination: "output_warehouse_1",
  items: {
    "oak_planks": 192,
    "cobblestone": 64
  }
}
```

#### 5.2.4 建造指令
```javascript
{
  type: "build",
  botId: "builder_1",
  blueprint: {
    file: "house_v1.json",
    position: {x: 0, y: 64, z: 0}
  },
  materials: {
    "oak_planks": 192,
    "cobblestone": 64
  },
  sourceWarehouse: "output_warehouse_1"
}
```

---

## 6. 技术实现

### 6.1 技术栈

**核心框架**:
- **Mineflayer**: v4.20.0+ (Minecraft bot framework)
- **Node.js**: v18+ (LTS)
- **TypeScript**: v5+ (类型安全)

**通信层**:
- **gRPC**: 指令接收 (与 OpenClaw 通信)
- **Protobuf**: 消息序列化

**数据存储**:
- **SQLite**: 本地库存数据库
- **Redis**: 实时任务队列 (可选)

### 6.2 目录结构

```
logistics-system/
├── src/
│   ├── controller/           # 主控制器
│   │   ├── LogisticsController.ts
│   │   ├── TaskManager.ts
│   │   └── RobotManager.ts
│   ├── bots/                 # 机器人实现
│   │   ├── ScavengerBot.ts
│   │   ├── WarehouserBot.ts
│   │   └── BuilderBot.ts
│   ├── warehouse/            # 仓库管理
│   │   ├── WarehouseManager.ts
│   │   ├── InputWarehouse.ts
│   │   ├── SortingWarehouse.ts
│   │   └── OutputWarehouse.ts
│   ├── inventory/            # 库存系统
│   │   ├── InventoryManager.ts
│   │   └── ItemDatabase.ts
│   ├── tasks/                # 任务处理
│   │   ├── TaskExecutor.ts
│   │   └── TaskQueue.ts
│   ├── communication/        # 通信层
│   │   ├── GrpcServer.ts
│   │   └── proto/
│   │       └── logistics.proto
│   └── utils/                # 工具函数
│       ├── PathFinder.ts
│       └── Logger.ts
├── data/
│   ├── blueprints/           # 建造蓝图
│   └── database/             # SQLite 数据库
├── config/
│   ├── warehouses.json       # 仓库配置
│   └── bots.json             # 机器人配置
├── tests/
│   ├── unit/
│   └── integration/
├── package.json
└── tsconfig.json
```

### 6.3 核心类设计

#### 6.3.1 LogisticsController
```typescript
class LogisticsController {
  private robotManager: RobotManager;
  private warehouseManager: WarehouseManager;
  private taskManager: TaskManager;
  private grpcServer: GrpcServer;

  async init(config: Config);
  async start();
  async stop();

  // 接收 OpenClaw 指令
  async handleInstruction(instruction: Instruction);

  // 分发任务
  async dispatchTask(task: Task);
}
```

#### 6.3.2 RobotManager
```typescript
class RobotManager {
  private scavengers: Map<string, ScavengerBot>;
  private warehousekeepers: Map<string, WarehouserBot>;
  private builders: Map<string, BuilderBot>;

  // 创建机器人
  async createRobot(role: string, config: BotConfig);

  // 获取可用机器人
  getAvailableRobot(role: string);

  // 分配任务
  async assignTask(robotId: string, task: Task);
}
```

#### 6.3.3 TaskManager
```typescript
class TaskManager {
  private taskQueue: PriorityQueue<Task>;

  // 添加任务
  enqueueTask(task: Task);

  // 执行任务
  async executeTask(task: Task);

  // 任务状态跟踪
  updateTaskStatus(taskId: string, status: TaskStatus);
}
```

---

## 7. 工作流程示例

### 7.1 完整物流流程

```
┌─────────────────────────────────────────────────────────────┐
│ 步骤 1: OpenClaw 发送建造指令                               │
├─────────────────────────────────────────────────────────────┤
│ {                                                           │
│   type: "build",                                           │
│   blueprint: "house_v1.json",                              │
│   materials: {                                             │
│     "oak_planks": 192,                                     │
│     "cobblestone": 64                                      │
│   }                                                        │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 步骤 2: TaskManager 分解任务                                │
├─────────────────────────────────────────────────────────────┤
│ Task 1: 拾荒者收集 64 个橡木原木                            │
│ Task 2: 仓库员从输入仓库分类到分类仓库                      │
│ Task 3: 仓库员从分类仓库调度到输出仓库                      │
│ Task 4: 建筑师从输出仓库取材料并建造                        │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Scavenger    │   │ Warehouser   │   │ Builder      │
│ 收集橡木原木 │──▶│ 分类调度     │──▶│ 建造房屋     │
└──────────────┘   └──────────────┘   └──────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
  Input Warehouse    Sorting Warehouse   Output Warehouse
```

### 7.2 物品流转示例

```
1. 拾荒者收集 64 个 oak_log
   └─▶ 存入 input_warehouse_1 (chest_1)

2. 仓库员执行分类任务
   └─▶ 从 input_warehouse_1 取出 oak_log
   └─▶ 存入 sorting_warehouse_1 (category: "wood")

3. 仓库员执行调度任务
   └─▶ 从 sorting_warehouse_1 (wood) 取出 oak_log
   └─▶ 转换为 oak_planks (如果有合成台)
   └─▶ 存入 output_warehouse_1 (oak_planks category)

4. 建筑师执行建造任务
   └─▶ 从 output_warehouse_1 预订 oak_planks * 192
   └─▶ 取出材料
   └─▶ 执行建造指令
```

---

## 8. 配置示例

### 8.1 仓库配置 (warehouses.json)
```json
{
  "warehouses": [
    {
      "id": "input_warehouse_1",
      "type": "input",
      "location": {"x": 0, "y": 64, "z": 0},
      "chests": [
        {"id": "chest_1", "position": {"x": 0, "y": 64, "z": 0}},
        {"id": "chest_2", "position": {"x": 2, "y": 64, "z": 0}}
      ]
    },
    {
      "id": "sorting_warehouse_1",
      "type": "sorting",
      "location": {"x": 10, "y": 64, "z": 0},
      "categories": {
        "wood": {"chestId": "chest_1"},
        "stone": {"chestId": "chest_2"},
        "ores": {"chestId": "chest_3"}
      }
    },
    {
      "id": "output_warehouse_1",
      "type": "output",
      "location": {"x": 20, "y": 64, "z": 0},
      "materials": {
        "oak_planks": {"chestId": "chest_1"},
        "cobblestone": {"chestId": "chest_2"}
      }
    }
  ]
}
```

### 8.2 机器人配置 (bots.json)
```json
{
  "bots": [
    {
      "id": "scavenger_1",
      "role": "scavenger",
      "username": "ScavengerBot1",
      "homePosition": {"x": 0, "y": 64, "z": 5}
    },
    {
      "id": "warehouser_1",
      "role": "warehouser",
      "username": "WarehouserBot1",
      "homePosition": {"x": 10, "y": 64, "z": 5}
    },
    {
      "id": "builder_1",
      "role": "builder",
      "username": "BuilderBot1",
      "homePosition": {"x": 20, "y": 64, "z": 5}
    }
  ]
}
```

---

## 9. 待确认事项

### 9.1 架构层面
- [ ] OpenClaw 指令格式是否需要调整?
- [ ] 是否需要支持多服务器实例?
- [ ] 机器人数量上限是多少?
- [ ] 是否需要机器人故障转移机制?

### 9.2 功能层面
- [ ] 是否需要自动合成功能(如 log → planks)?
- [ ] 仓库员是否需要跨仓库搬运物品?
- [ ] 是否需要优先级队列(高优先级建造任务优先)?
- [ ] 是否需要物品追踪功能(知道某个物品在哪个箱子)?

### 9.3 性能层面
- [ ] 单个仓库的最大容量限制?
- [ ] 任务队列的最大长度?
- [ ] 是否需要任务超时机制?
- [ ] 是否需要机器人路径缓存?

### 9.4 扩展性
- [ ] 未来是否需要添加新职业?
- [ ] 是否需要支持多种分类策略?
- [ ] 是否需要仓库网络拓扑(多个输入仓库对应一个分类仓库)?

---

## 10. 下一步计划

1. **确认需求**: 根据待确认事项调整设计方案
2. **原型开发**: 实现最小可行系统 (1 拾荒者 + 1 仓库员 + 1 建筑师)
3. **测试验证**: 在真实 Minecraft 环境中测试流程
4. **性能优化**: 根据测试结果优化机器人协作效率
5. **功能扩展**: 添加高级功能(自动合成、路径规划等)

---

**文档版本**: v1.0
**作者**: Claude Code
**最后更新**: 2026-03-23
**状态**: 待审核
