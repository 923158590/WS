# 训练家系统 (OpenClaw兼容)

基于 OpenAI Gym / OpenClaw 标准的物流仓库AI训练环境

## 🎯 核心特性

**OpenClaw兼容接口**：
- ✅ 标准观察空间（23维特征向量）
- ✅ 离散动作空间（10个动作）
- ✅ 标准Gym接口：`reset()`, `step()`, `render()`, `close()`
- ✅ 奖励函数设计
- ✅ 空间信息获取：`getSpaces()`

## 📁 文件说明

### 核心系统

- **`warehouse-training-env.js`** (18KB)
  - OpenClaw兼容的训练环境
  - 观察空间：23维特征向量
  - 动作空间：10个离散动作
  - Gym标准接口

- **`train-agent.js`** (8.1KB)
  - Agent训练示例
  - RuleBasedAgent vs RandomAgent对比

### 支持模块

- **`task-generator.js`** (7.9KB) - 任务生成器
- **`warehouse-env.js`** (8.1KB) - 仓库环境模拟

## 🎮 观察空间

### 结构

```javascript
{
  vector: [23],  // 扁平化特征向量（OpenClaw主要使用）
  dict: {
    warehouseFeatures: [15],  // 3个仓库 × 5个特征
    globalFeatures: [5],      // 全局特征
    taskAvailability: [3]     // 任务可用性
  }
}
```

### 特征说明

**仓库特征 (15维)**：
- 仓库类型 (0-1归一化)
- 利用率 (0-1)
- 物品数量 (归一化)
- X坐标 (归一化)
- Z坐标 (归一化)

**全局特征 (5维)**：
- 总物品数 (归一化)
- 输入仓库物品数
- 分类仓库物品数
- 输出仓库物品数
- 输出目标完成度 (0-1)

**任务可用性 (3维)**：
- 是否可执行输入→分类 (0/1)
- 是否可执行分类→输出 (0/1)
- 是否需要补充输出 (0/1)

## 🎮 动作空间

### 10个离散动作

| 索引 | 动作名称 | 说明 |
|------|---------|------|
| 0 | NOOP | 无操作 |
| 1 | TRANSFER_INPUT_SORTING | 输入→分类 (木材类) |
| 2 | TRANSFER_INPUT_SORTING_STONE | 输入→分类 (石材类) |
| 3 | TRANSFER_INPUT_SORTING_ALL | 输入→分类 (全部) |
| 4 | DISPATCH_TO_OUTPUT | 调度到输出 (按需) |
| 5 | BATCH_TRANSFER_2 | 批次搬运2种物品 |
| 6 | BATCH_TRANSFER_3 | 批次搬运3种物品 |
| 7 | SMART_DISPATCH | 智能调度 |
| 8 | PRIORITY_DISPATCH | 优先级调度 |
| 9 | CLEAR_INPUT | 清空输入仓库 |

## 🚀 快速开始

### 基础使用

```javascript
const { WarehouseTrainingEnv } = require('./warehouse-training-env');

// 1. 创建环境
const env = new WarehouseTrainingEnv(warehouseManager, warehouserBot, scheduler);

// 2. 查看空间信息
const spaces = env.getSpaces();
console.log('Observation space:', spaces.observation);
console.log('Action space:', spaces.action);

// 3. 训练循环
for (let episode = 0; episode < 100; episode++) {
  let observation = env.reset();

  while (true) {
    // Agent选择动作 (0-9)
    const action = agent.selectAction(observation.vector);

    // 执行动作
    const result = await env.step(action);

    observation = result.observation;
    const reward = result.reward;
    const done = result.done;
    const info = result.info;

    // Agent学习
    agent.learn(reward, observation);

    if (done) break;
  }
}

env.close();
```

### OpenClaw集成示例

```javascript
// OpenClaw期望的标准接口
class OpenClawAgent {
  constructor(env) {
    this.env = env;
    this.spaces = env.getSpaces();

    // 初始化Q表或其他学习算法
    this.qTable = new Array(this.spaces.action.n).fill(0);
  }

  async train(episodes) {
    for (let episode = 0; episode < episodes; episode++) {
      let observation = this.env.reset();
      let totalReward = 0;

      while (true) {
        // ε-greedy策略选择动作
        const action = this.selectAction(observation.vector);

        // 执行动作
        const { observation: nextObs, reward, done, info } = await this.env.step(action);

        // 更新Q值
        this.updateQValue(observation.vector, action, reward, nextObs.vector);

        totalReward += reward;
        observation = nextObs;

        if (done) break;
      }

      console.log(`Episode ${episode}: Reward = ${totalReward.toFixed(2)}`);
    }
  }

  selectAction(observationVector) {
    // 根据观察选择动作 (0-9)
    return Math.floor(Math.random() * 10);
  }

  updateQValue(state, action, reward, nextState) {
    // Q-learning更新
  }
}
```

## 📊 空间信息

### 获取空间信息

```javascript
const env = new WarehouseTrainingEnv(...);
const spaces = env.getSpaces();

// 观察空间
spaces.observation = {
  type: 'dict',
  shape: {
    warehouseFeatures: { type: 'array', shape: [15] },
    globalFeatures: { type: 'array', shape: [5] },
    taskAvailability: { type: 'array', shape: [3] }
  },
  totalSize: 23
}

// 动作空间
spaces.action = {
  type: 'discrete',
  n: 10,
  actions: ['NOOP', 'TRANSFER_INPUT_SORTING', ...]
}
```

## 🎯 奖励函数

```javascript
reward = successCount * 10          // 成功执行：+10
         - failCount * 5             // 失败：-5
         + efficiencyBonus           // 效率奖励
         + completionBonus           // 目标完成：+50
```

## 🧪 运行测试

```bash
# 运行训练示例
node train-agent.js
```

## 📚 与不同AI框架集成

### 1. Q-Learning

```javascript
class QLearningAgent {
  constructor(env, alpha=0.1, gamma=0.9, epsilon=0.1) {
    this.env = env;
    this.alpha = alpha;
    this.gamma = gamma;
    this.epsilon = epsilon;
    this.qTable = new Map();
  }

  getStateKey(obs) {
    return obs.vector.slice(0, 10).map(v => Math.round(v * 10)).join(',');
  }

  selectAction(observation) {
    const state = this.getStateKey(observation);

    if (!this.qTable.has(state)) {
      this.qTable.set(state, new Array(10).fill(0));
    }

    if (Math.random() < this.epsilon) {
      return Math.floor(Math.random() * 10); // 探索
    }

    const qValues = this.qTable.get(state);
    return qValues.indexOf(Math.max(...qValues)); // 利用
  }

  update(state, action, reward, nextState) {
    const stateKey = this.getStateKey({ vector: state });
    const nextStateKey = this.getStateKey({ vector: nextState });

    if (!this.qTable.has(nextStateKey)) {
      this.qTable.set(nextStateKey, new Array(10).fill(0));
    }

    const qValues = this.qTable.get(stateKey);
    const nextQValues = this.qTable.get(nextStateKey);
    const maxNextQ = Math.max(...nextQValues);

    qValues[action] += this.alpha * (reward + this.gamma * maxNextQ - qValues[action]);
  }
}
```

### 2. Deep Q-Network (TensorFlow.js)

```javascript
const tf = require('@tensorflow/tfjs');

class DQNAgent {
  constructor(env) {
    this.env = env;
    this.model = this.buildModel();
    this.gamma = 0.95;
    this.epsilon = 0.1;
  }

  buildModel() {
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 64, activation: 'relu', inputShape: [23] }));
    model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 10, activation: 'linear' }));
    model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });
    return model;
  }

  selectAction(observation) {
    if (Math.random() < this.epsilon) {
      return Math.floor(Math.random() * 10);
    }

    const qValues = this.model.predict(tf.tensor2d([observation.vector]));
    return qValues.argMax(-1).dataSync()[0];
  }

  async train(batch) {
    // 训练DQN
    await this.model.fit(batch.states, batch.targets);
  }
}
```

### 3. OpenClaw原生接口

```javascript
// OpenClaw期望的接口
const env = new WarehouseTrainingEnv(...);

// 标准方法
env.reset();
env.step(action);
env.render();
env.close();
env.getSpaces();
env.seed(42);

// 返回格式
{
  observation: { vector: [23], dict: {...} },
  reward: 10.5,
  done: false,
  info: { episode: 1, step: 5, ... }
}
```

## 📖 API文档

### WarehouseTrainingEnv

#### 构造函数
```javascript
new WarehouseTrainingEnv(warehouseManager, warehouserBot, scheduler)
```

#### 方法

**reset()** - 重置环境
- 返回：`{ vector: [23], dict: {...} }`

**step(action)** - 执行动作
- 参数：`action` (number) - 动作索引 0-9
- 返回：`{ observation, reward, done, info }`

**render()** - 可视化（可选）
- 返回：`void`

**close()** - 关闭环境，打印统计
- 返回：`void`

**getSpaces()** - 获取空间信息
- 返回：`{ observation, action }`

**seed(seed)** - 设置随机种子
- 参数：`seed` (number)
- 返回：`void`

## 🔄 迁移指南

### 从旧版本迁移

如果你使用的是旧版本的非OpenClaw环境：

```javascript
// ❌ 旧版本
const tasks = trainer.generateTaskSequence();
const optimized = trainer.optimizeTaskSequence();
await trainer.executeTaskSequence();

// ✅ 新版本 (OpenClaw兼容)
const env = new WarehouseTrainingEnv(...);
const obs = env.reset();
const result = await env.step(action); // action: 0-9
```

---

**更新日期**: 2026-03-24
**版本**: v3.0 (OpenClaw Compatible)
**状态**: ✅ OpenClaw标准接口
