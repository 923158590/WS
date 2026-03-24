# WarehouserBot 执行接口使用指南

## 🎯 统一执行接口

`WarehouserBot` 现在支持灵活的参数解析和执行接口。

## 基本用法

### 1. execute() - 统一执行接口

```javascript
const { WarehouserBot } = require('./bots/warehouserBot');

const bot = new WarehouserBot(mineflayerBot, warehouseManager);
```

### 支持的参数格式

#### 格式1: 字符串动作名 + 参数对象

```javascript
// 移动
await bot.execute('moveTo', { x: 100, y: 64, z: 200 });

// 取物
await bot.execute('withdraw', {
  chestPosition: { x: 100, y: 64, z: 200 },
  itemType: 'oak_log',
  quantity: 64
});

// 存物
await bot.execute('deposit', {
  chestPosition: { x: 110, y: 64, z: 200 },
  itemType: 'oak_log',
  quantity: 64
});
```

#### 格式2: 包含 type 字段的对象

```javascript
// 移动
await bot.execute({
  type: 'moveTo',
  x: 100,
  y: 64,
  z: 200
});

// 取物
await bot.execute({
  type: 'withdraw',
  chestPosition: { x: 100, y: 64, z: 200 },
  itemType: 'oak_log',
  quantity: 64
});
```

#### 格式3: 自动推断动作类型（无type字段）

```javascript
// 自动推断为 moveTo
await bot.execute({ x: 100, y: 64, z: 200 });

// 自动推断为 withdraw
await bot.execute({
  chestPosition: { x: 100, y: 64, z: 200 },
  itemType: 'oak_log',
  quantity: 64,
  withdraw: true  // 标记为取物
});

// 自动推断为 deposit
await bot.execute({
  chestPosition: { x: 110, y: 64, z: 200 },
  itemType: 'oak_log',
  quantity: 64,
  deposit: true  // 标记为存物
});
```

### 支持的动作类型

| 动作类型 | 别名 | 必需参数 | 说明 |
|---------|------|---------|------|
| `moveTo` | - | `x, y, z` 或 `position` 或 `location` | 移动到指定位置 |
| `withdrawFromChest` | `withdraw` | `chestPosition, itemType, quantity` | 从箱子取物 |
| `depositToChest` | `deposit` | `chestPosition, itemType, quantity` | 存物到箱子 |
| `moveInventoryToChest` | - | `itemType, quantity, chestPosition` | 背包→箱子 |
| `moveChestToInventory` | - | `chestPosition, itemType, quantity` | 箱子→背包 |
| `wait` | - | `duration` (可选) | 等待时间或等待空闲 |
| `getStatus` | - | 无 | 获取状态 |

### 位置参数的多种格式

```javascript
// 格式1: x, y, z
await bot.execute('moveTo', { x: 100, y: 64, z: 200 });

// 格式2: position
await bot.execute('moveTo', {
  position: { x: 100, y: 64, z: 200 }
});

// 格式3: location
await bot.execute('moveTo', {
  location: { x: 100, y: 64, z: 200 }
});
```

## 批量执行

### executeBatch() - 批量执行动作

```javascript
const actions = [
  { type: 'moveTo', x: 100, y: 64, z: 200 },
  { type: 'withdraw', chestPosition: { x: 100, y: 64, z: 200 }, itemType: 'oak_log', quantity: 64 },
  { type: 'moveTo', x: 110, y: 64, z: 200 },
  { type: 'deposit', chestPosition: { x: 110, y: 64, z: 200 }, itemType: 'oak_log', quantity: 64 }
];

const results = await bot.executeBatch(actions);

results.forEach((result, i) => {
  console.log(`Action ${i + 1}: ${result.success ? '✅' : '❌'}`);
});
```

## 返回值格式

### 成功执行

```javascript
{
  success: true,
  actionType: 'moveTo',
  result: {
    success: true,
    position: { x: 100, y: 64, z: 200 }
  }
}
```

### 执行失败

```javascript
{
  success: false,
  error: 'Missing position parameters'
}
```

## 实际应用示例

### 示例1: 简单搬运

```javascript
async function simpleTransfer(bot) {
  const actions = [
    // 1. 移动到源箱子
    { type: 'moveTo', x: 100, y: 64, z: 200 },

    // 2. 取出物品
    {
      type: 'withdraw',
      chestPosition: { x: 100, y: 64, z: 200 },
      itemType: 'oak_log',
      quantity: 64
    },

    // 3. 移动到目标箱子
    { type: 'moveTo', x: 110, y: 64, z: 200 },

    // 4. 存入物品
    {
      type: 'deposit',
      chestPosition: { x: 110, y: 64, z: 200 },
      itemType: 'oak_log',
      quantity: 64
    }
  ];

  const results = await bot.executeBatch(actions);
  console.log('Transfer completed:', results);
}
```

### 示例2: 从训练环境调用

```javascript
// 在训练环境中使用
class MyAgent {
  selectAction(observation) {
    // 返回动作对象
    return {
      type: 'withdraw',
      chestPosition: { x: 100, y: 64, z: 200 },
      itemType: 'oak_log',
      quantity: 64
    };
  }

  async executeAction(bot, action) {
    // 直接传给bot执行
    const result = await bot.execute(action);
    return result;
  }
}
```

### 示例3: 高级错误处理

```javascript
async function safeExecute(bot, action) {
  const result = await bot.execute(action);

  if (!result.success) {
    console.error('Action failed:', result.error);

    // 根据错误类型处理
    if (result.error.includes('chest')) {
      console.log('Trying alternative chest...');
      // 重试逻辑
    }
  }

  return result;
}
```

## 旧API兼容性

原有的方法调用方式仍然支持：

```javascript
// 直接调用方法（旧方式）
await bot.moveTo({ x: 100, y: 64, z: 200 });
await bot.withdrawFromChest({ x: 100, y: 64, z: 200 }, 'oak_log', 64);
await bot.depositToChest({ x: 110, y: 64, z: 200 }, 'oak_log', 64);

// 使用execute（新方式）
await bot.execute('moveTo', { x: 100, y: 64, z: 200 });
await bot.execute('withdraw', {
  chestPosition: { x: 100, y: 64, z: 200 },
  itemType: 'oak_log',
  quantity: 64
});
```

## 参数归一化

接口会自动处理参数格式的差异：

```javascript
// 这些调用是等价的：

// 1. 直接位置
await bot.execute('moveTo', { x: 100, y: 64, z: 200 });

// 2. position对象
await bot.execute('moveTo', { position: { x: 100, y: 64, z: 200 } });

// 3. location对象
await bot.execute('moveTo', { location: { x: 100, y: 64, z: 200 } });
```

## 调试支持

### 查看执行日志

```javascript
// 启用详细日志
const result = await bot.execute({
  type: 'moveTo',
  x: 100,
  y: 64,
  z: 200
});

// 控制台输出：
// [Warehouser] 🎯 Executing: moveTo
// [Warehouser] 📋 Params: {"x":100,"y":64,"z":200}
// [Warehouser] 🚶 Moving to 100, 64, 200
// [Warehouser] ✅ Arrived at 100, 64, 200
// [Warehouser] ✅ Action completed: moveTo
```

## 性能考虑

1. **批量操作优先**: 使用 `executeBatch()` 代替多次 `execute()`
2. **错误处理**: 检查返回值的 `success` 字段
3. **异步执行**: 所有方法都是异步的，记得使用 `await`

## 完整示例

```javascript
const { WarehouserBot } = require('./bots/warehouserBot');
const mineflayer = require('mineflayer');

async function main() {
  const bot = mineflayer.createBot({
    host: 'localhost',
    port: 25565,
    username: 'WarehouserBot'
  });

  bot.on('spawn', async () => {
    const warehouser = new WarehouserBot(bot, warehouseManager);

    // 执行动作序列
    const result = await warehouser.execute({
      type: 'moveTo',
      x: 100,
      y: 64,
      z: 200
    });

    console.log('Result:', result);
  });
}

main();
```

---

**更新日期**: 2026-03-24
**版本**: v2.0 (支持参数解析)
