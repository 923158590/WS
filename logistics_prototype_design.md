# 物流系统最小原型验证方案

> **项目代号**: OpenClaw Logistics Prototype
> **版本**: v0.1-alpha
> **日期**: 2026-03-23
> **目标**: 验证仓库员核心功能

---

## 1. 原型目标

### 1.1 验证范围
✅ **仅验证仓库员 (Warehouser) 功能**
❌ 拾荒者 - 使用模拟代码替代
❌ 建筑师 - 使用模拟代码替代

### 1.2 核心验证点
1. **输入仓库** → 随机物品生成
2. **分类仓库** → 自动分类存储
3. **输出仓库** → 物品调度
4. **仓库员** → 全局物品搬运能力
5. **清单统计** → 实时库存追踪

---

## 2. 系统架构 (简化版)

```
┌─────────────────────────────────────────────────────────┐
│                   模拟层 (Simulation)                   │
├─────────────────────────────────────────────────────────┤
│  1️⃣ 随机物品生成器  │  2️⃣ 库存统计器  │  3️⃣ 成功验证器 │
└────────────────────────┬───────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                 Minecraft 世界                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐    │
│  │  Input   │ ───▶ │ Sorting  │ ───▶ │ Output   │    │
│  │ Warehouse│      │ Warehouse│      │ Warehouse│    │
│  │          │      │          │      │          │    │
│  │ 随机物品 │      │ 自动分类 │      │ 目标物品 │    │
│  └──────────┘      └──────────┘      └──────────┘    │
│         ▲                  │                  │        │
│         │                  ▼                  │        │
│         │         ┌─────────────┐             │        │
│         │         │ Warehouser  │─────────────┘        │
│         │         │   仓库员    │    全局搬运           │
│         │         └─────────────┘                      │
│         └────────────────────┘                        │
│              模拟器持续生成                              │
└─────────────────────────────────────────────────────────┘
```

---

## 3. 模拟代码设计

### 3.1 随机物品生成器

**文件**: `simulation/randomItemGenerator.js`

**功能**:
- 持续向输入仓库添加随机物品
- 模拟拾荒者的收集行为
- 支持配置物品类型、数量范围

**代码实现**:

```javascript
/**
 * 随机物品生成器
 * 模拟拾荒者向输入仓库添加物品
 */
class RandomItemGenerator {
  constructor(warehouseManager) {
    this.warehouseManager = warehouseManager;
    this.isRunning = false;
    this.intervalId = null;

    // 预定义物品池
    this.itemPool = [
      // 木材类
      'oak_log', 'birch_log', 'spruce_log', 'jungle_log',
      'oak_planks', 'birch_planks', 'spruce_planks',

      // 石材类
      'stone', 'cobblestone', 'andesite', 'diorite', 'granite',

      // 矿物类
      'coal', 'iron_ingot', 'gold_ingot', 'diamond',

      // 食物类
      'wheat', 'carrot', 'potato', 'bread',

      // 工具类
      'wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe',

      // 杂项
      'stick', 'iron_nugget', 'gold_nugget'
    ];

    // 配置参数
    this.config = {
      generationInterval: 5000,  // 每5秒生成一次
      minItemsPerBatch: 3,       // 最少物品种类
      maxItemsPerBatch: 8,       // 最多物品种类
      minQuantity: 1,            // 最小数量
      maxQuantity: 64            // 最大数量
    };
  }

  /**
   * 启动生成器
   */
  start() {
    if (this.isRunning) {
      console.log('[RandomItemGenerator] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[RandomItemGenerator] Starting random item generation...');

    // 立即生成一次
    this.generateBatch();

    // 定时生成
    this.intervalId = setInterval(() => {
      this.generateBatch();
    }, this.config.generationInterval);

    console.log(`[RandomItemGenerator] Started (interval: ${this.config.generationInterval}ms)`);
  }

  /**
   * 停止生成器
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('[RandomItemGenerator] Stopped');
  }

  /**
   * 生成一批随机物品
   */
  generateBatch() {
    const itemCount = this.randomInt(
      this.config.minItemsPerBatch,
      this.config.maxItemsPerBatch
    );

    const batch = [];

    // 随机选择物品
    for (let i = 0; i < itemCount; i++) {
      const item = this.itemPool[
        Math.floor(Math.random() * this.itemPool.length)
      ];
      const quantity = this.randomInt(
        this.config.minQuantity,
        this.config.maxQuantity
      );

      batch.push({ item, quantity });
    }

    // 去重并合并相同物品
    const mergedBatch = this.mergeBatch(batch);

    // 添加到输入仓库
    const inputWarehouse = this.warehouseManager.getWarehouse('input_warehouse_1');

    if (!inputWarehouse) {
      console.error('[RandomItemGenerator] Input warehouse not found!');
      return;
    }

    let addedCount = 0;
    for (const { item, quantity } of mergedBatch) {
      const success = inputWarehouse.depositItem(item, quantity);
      if (success) {
        addedCount++;
        console.log(`[RandomItemGenerator] ✅ Added ${quantity}x ${item} to input warehouse`);
      } else {
        console.log(`[RandomItemGenerator] ⚠️  Failed to add ${quantity}x ${item} (warehouse full?)`);
      }
    }

    console.log(`[RandomItemGenerator] 📦 Batch complete: ${addedCount}/${mergedBatch.length} items added`);
  }

  /**
   * 合并批次中相同的物品
   */
  mergeBatch(batch) {
    const merged = new Map();

    for (const { item, quantity } of batch) {
      const existing = merged.get(item) || 0;
      merged.set(item, existing + quantity);
    }

    return Array.from(merged.entries()).map(([item, quantity]) => ({
      item,
      quantity
    }));
  }

  /**
   * 生成随机整数 [min, max]
   */
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };

    // 重启定时器（如果正在运行）
    if (this.isRunning) {
      this.stop();
      this.start();
    }

    console.log('[RandomItemGenerator] Config updated:', this.config);
  }
}

module.exports = { RandomItemGenerator };
```

---

### 3.2 库存统计器

**文件**: `simulation/inventoryStatistics.js`

**功能**:
- 扫描所有仓库
- 生成详细清单
- 输出人类可读报告

**代码实现**:

```javascript
/**
 * 库存统计器
 * 扫描所有仓库并生成清单
 */
class InventoryStatistics {
  constructor(warehouseManager) {
    this.warehouseManager = warehouseManager;
  }

  /**
   * 生成完整库存报告
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      warehouses: {}
    };

    const warehouses = this.warehouseManager.getAllWarehouses();

    for (const [id, warehouse] of Object.entries(warehouses)) {
      const inventory = warehouse.getInventory();
      const totalItems = this.countTotalItems(inventory);

      report.warehouses[id] = {
        type: warehouse.type,
        location: warehouse.location,
        totalItems,
        capacity: warehouse.getTotalCapacity(),
        utilizationRate: ((totalItems / warehouse.getTotalCapacity()) * 100).toFixed(2) + '%',
        inventory: this.formatInventory(inventory)
      };
    }

    return report;
  }

  /**
   * 打印人类可读报告
   */
  printReport() {
    const report = this.generateReport();

    console.log('\n' + '='.repeat(80));
    console.log(`📊 库存统计报告 - ${report.timestamp}`);
    console.log('='.repeat(80));

    for (const [id, data] of Object.entries(report.warehouses)) {
      console.log(`\n🏠 ${id} (${data.type})`);
      console.log(`   位置: ${JSON.stringify(data.location)}`);
      console.log(`   总物品数: ${data.totalItems}`);
      console.log(`   容量利用率: ${data.utilizationRate}`);

      if (data.inventory.length > 0) {
        console.log(`   物品清单:`);

        // 按数量降序排列
        const sortedInventory = data.inventory
          .sort((a, b) => b.quantity - a.quantity);

        for (const { item, quantity } of sortedInventory) {
          console.log(`      - ${quantity.toString().padStart(4)}x ${item}`);
        }
      } else {
        console.log(`   (空)`);
      }
    }

    // 汇总统计
    const grandTotal = Object.values(report.warehouses)
      .reduce((sum, wh) => sum + wh.totalItems, 0);

    console.log('\n' + '-'.repeat(80));
    console.log(`📈 全局总计: ${grandTotal} 件物品`);
    console.log('='.repeat(80) + '\n');

    return report;
  }

  /**
   * 生成清单列表 (JSON)
   */
  generateManifest() {
    const report = this.generateReport();
    const manifest = {
      timestamp: report.timestamp,
      summary: {
        totalWarehouses: Object.keys(report.warehouses).length,
        totalItems: Object.values(report.warehouses)
          .reduce((sum, wh) => sum + wh.totalItems, 0)
      },
      warehouses: {}
    };

    for (const [id, data] of Object.entries(report.warehouses)) {
      manifest.warehouses[id] = {
        type: data.type,
        totalItems: data.totalItems,
        inventory: data.inventory
      };
    }

    return manifest;
  }

  /**
   * 统计总物品数
   */
  countTotalItems(inventory) {
    return Object.values(inventory)
      .reduce((sum, qty) => sum + qty, 0);
  }

  /**
   * 格式化库存为列表
   */
  formatInventory(inventory) {
    return Object.entries(inventory)
      .map(([item, quantity]) => ({ item, quantity }));
  }

  /**
   * 比较两个时间点的库存变化
   */
  compareReports(oldReport, newReport) {
    const changes = {
      timestamp: newReport.timestamp,
      changes: {}
    };

    for (const [id, newWh] of Object.entries(newReport.warehouses)) {
      const oldWh = oldReport.warehouses[id];

      if (!oldWh) {
        changes.changes[id] = {
          type: 'new',
          message: '新仓库'
        };
        continue;
      }

      // 比较物品变化
      const itemChanges = {};

      // 检查新增/增加的物品
      for (const newItem of newWh.inventory) {
        const oldItem = oldWh.inventory.find(i => i.item === newItem.item);

        if (!oldItem) {
          itemChanges[newItem.item] = {
            old: 0,
            new: newItem.quantity,
            change: `+${newItem.quantity}`
          };
        } else if (oldItem.quantity !== newItem.quantity) {
          const diff = newItem.quantity - oldItem.quantity;
          itemChanges[newItem.item] = {
            old: oldItem.quantity,
            new: newItem.quantity,
            change: diff > 0 ? `+${diff}` : diff
          };
        }
      }

      // 检查减少/删除的物品
      for (const oldItem of oldWh.inventory) {
        const newItem = newWh.inventory.find(i => i.item === oldItem.item);

        if (!newItem) {
          itemChanges[oldItem.item] = {
            old: oldItem.quantity,
            new: 0,
            change: `-${oldItem.quantity}`
          };
        }
      }

      changes.changes[id] = {
        type: 'update',
        itemChanges
      };
    }

    return changes;
  }

  /**
   * 打印库存变化报告
   */
  printChangeReport(oldReport, newReport) {
    const changes = this.compareReports(oldReport, newReport);

    console.log('\n' + '='.repeat(80));
    console.log(`📊 库存变化报告 - ${changes.timestamp}`);
    console.log('='.repeat(80));

    for (const [id, changeData] of Object.entries(changes.changes)) {
      if (changeData.type === 'new') {
        console.log(`\n🏠 ${id}: ${changeData.message}`);
        continue;
      }

      console.log(`\n🏠 ${id}:`);

      if (Object.keys(changeData.itemChanges).length === 0) {
        console.log(`   (无变化)`);
        continue;
      }

      for (const [item, data] of Object.entries(changeData.itemChanges)) {
        const arrow = data.change.includes('+') ? '⬆️' : '⬇️';
        console.log(`   ${arrow} ${item}: ${data.old} → ${data.new} (${data.change})`);
      }
    }

    console.log('\n' + '='.repeat(80) + '\n');
  }
}

module.exports = { InventoryStatistics };
```

---

### 3.3 成功验证器

**文件**: `simulation/successValidator.js`

**功能**:
- 检查输出仓库是否达到目标物品
- 验证仓库员任务完成度
- 触发成功信号

**代码实现**:

```javascript
/**
 * 成功验证器
 * 检查输出仓库是否满足目标条件
 */
class SuccessValidator {
  constructor(warehouseManager) {
    this.warehouseManager = warehouseManager;
    this.targets = new Map(); // warehouseId -> target items
    this.callbacks = new Map(); // warehouseId -> callback
  }

  /**
   * 设置目标仓库
   */
  setTarget(warehouseId, targetItems, onSuccess) {
    this.targets.set(warehouseId, targetItems);
    this.callbacks.set(warehouseId, onSuccess);

    console.log(`[SuccessValidator] 🎯 Target set for ${warehouseId}:`);
    console.log(JSON.stringify(targetItems, null, 2));
  }

  /**
   * 验证仓库是否达标
   */
  validate(warehouseId) {
    const warehouse = this.warehouseManager.getWarehouse(warehouseId);

    if (!warehouse) {
      console.error(`[SuccessValidator] Warehouse not found: ${warehouseId}`);
      return false;
    }

    const targetItems = this.targets.get(warehouseId);

    if (!targetItems) {
      console.warn(`[SuccessValidator] No target set for: ${warehouseId}`);
      return false;
    }

    const inventory = warehouse.getInventory();
    const result = this.checkTarget(inventory, targetItems);

    if (result.success) {
      console.log(`[SuccessValidator] ✅ SUCCESS! ${warehouseId} reached target:`);
      console.log(JSON.stringify(result.details, null, 2));

      // 触发成功回调
      const callback = this.callbacks.get(warehouseId);
      if (callback) {
        callback(warehouseId, result);
      }

      return true;
    } else {
      console.log(`[SuccessValidator] ⏳ Progress ${warehouseId}:`);
      console.log(JSON.stringify(result.progress, null, 2));

      return false;
    }
  }

  /**
   * 检查是否达到目标
   */
  checkTarget(inventory, targetItems) {
    const details = {};
    const progress = {};
    let allMet = true;

    for (const [item, targetQuantity] of Object.entries(targetItems)) {
      const currentQuantity = inventory[item] || 0;
      const percentage = (currentQuantity / targetQuantity) * 100;
      const met = currentQuantity >= targetQuantity;

      details[item] = {
        target: targetQuantity,
        current: currentQuantity,
        percentage: percentage.toFixed(2) + '%',
        status: met ? '✅' : '⏳'
      };

      progress[item] = {
        current: currentQuantity,
        target: targetQuantity,
        remaining: Math.max(0, targetQuantity - currentQuantity),
        percentage: percentage.toFixed(2) + '%'
      };

      if (!met) {
        allMet = false;
      }
    }

    return {
      success: allMet,
      details,
      progress
    };
  }

  /**
   * 打印目标进度
   */
  printProgress(warehouseId) {
    const warehouse = this.warehouseManager.getWarehouse(warehouseId);

    if (!warehouse) {
      return;
    }

    const targetItems = this.targets.get(warehouseId);

    if (!targetItems) {
      console.log(`[SuccessValidator] No target set for: ${warehouseId}`);
      return;
    }

    const inventory = warehouse.getInventory();
    const result = this.checkTarget(inventory, targetItems);

    console.log(`\n🎯 目标进度: ${warehouseId}`);
    console.log('-'.repeat(60));

    for (const [item, data] of Object.entries(result.progress)) {
      const bar = this.createProgressBar(parseFloat(data.percentage));
      console.log(`${item.padEnd(25)} ${bar} ${data.current}/${data.target}`);
    }

    console.log('-'.repeat(60));

    if (result.success) {
      console.log('✅ 目标完成!\n');
    } else {
      console.log('⏳ 进行中...\n');
    }
  }

  /**
   * 创建进度条
   */
  createProgressBar(percentage) {
    const width = 30;
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;

    return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
  }

  /**
   * 移除目标
   */
  removeTarget(warehouseId) {
    this.targets.delete(warehouseId);
    this.callbacks.delete(warehouseId);
    console.log(`[SuccessValidator] Target removed for: ${warehouseId}`);
  }

  /**
   * 清除所有目标
   */
  clearAllTargets() {
    this.targets.clear();
    this.callbacks.clear();
    console.log(`[SuccessValidator] All targets cleared`);
  }
}

module.exports = { SuccessValidator };
```

---

## 4. 仓库员核心实现

**重要**: 仓库员是**纯执行器**，不做任何算法决策！

**文件**: `bots/warehouserBot.js`

**职责**:
- 移动到指定位置
- 从箱子中取出物品
- 将物品放入箱子

**不做**:
- ❌ 不决定搬运什么物品
- ❌ 不决定搬运到哪里
- ❌ 不做调度算法
- ❌ 不做智能决策

**代码实现**:

```javascript
/**
 * 仓库员机器人 (纯执行器)
 * 只负责基础动作：移动、取物、放物
 * 所有智能决策由 AI 调度器完成
 */
class WarehouserBot {
  constructor(mineflayerBot, warehouseManager) {
    this.bot = mineflayerBot;
    this.warehouseManager = warehouseManager;
    this.isBusy = false;
    this.currentAction = null;

    console.log(`[Warehouser] ${this.bot.username} initialized (executor only)`);
  }

  /**
   * 移动到指定位置
   * @param {Object} location - 目标位置 {x, y, z}
   */
  async moveTo(location) {
    const { x, y, z } = location;

    console.log(`[Warehouser] 🚶 Moving to ${x}, ${y}, ${z}`);

    const goal = new this.goals.GoalBlock(x, y, z);

    try {
      await this.bot.pathfinder.goto(goal);
      console.log(`[Warehouser] ✅ Arrived at ${x}, ${y}, ${z}`);
      return true;
    } catch (error) {
      console.error(`[Warehouser] ❌ Navigation failed: ${error.message}`);
      return false;
    }
  }

  /**
   * 从指定箱子取出物品
   * @param {Object} chestPosition - 箱子位置 {x, y, z}
   * @param {string} itemType - 物品类型
   * @param {number} quantity - 数量
   */
  async withdrawFromChest(chestPosition, itemType, quantity) {
    this.isBusy = true;
    this.currentAction = {
      type: 'withdraw',
      chestPosition,
      itemType,
      quantity
    };

    try {
      console.log(`[Warehouser] 📤 Withdrawing ${quantity}x ${itemType} from chest at ${JSON.stringify(chestPosition)}`);

      // 移动到箱子位置
      await this.moveTo(chestPosition);

      // 打开箱子
      const chest = await this.openChest(chestPosition);
      if (!chest) {
        throw new Error('Failed to open chest');
      }

      // 取出物品
      const item = chest.items().find(item => item && item.name === itemType);
      if (!item) {
        throw new Error(`Item ${itemType} not found in chest`);
      }

      // 计算实际可取数量
      const toWithdraw = Math.min(quantity, item.count);
      await chest.withdraw(item.type, null, toWithdraw);

      // 关闭箱子
      chest.close();

      console.log(`[Warehouser] ✅ Withdrew ${toWithdraw}x ${itemType}`);
      return { itemType, quantity: toWithdraw };

    } catch (error) {
      console.error(`[Warehouser] ❌ Withdraw failed: ${error.message}`);
      return null;
    } finally {
      this.isBusy = false;
      this.currentAction = null;
    }
  }

  /**
   * 将物品放入指定箱子
   * @param {Object} chestPosition - 箱子位置 {x, y, z}
   * @param {string} itemType - 物品类型
   * @param {number} quantity - 数量
   */
  async depositToChest(chestPosition, itemType, quantity) {
    this.isBusy = true;
    this.currentAction = {
      type: 'deposit',
      chestPosition,
      itemType,
      quantity
    };

    try {
      console.log(`[Warehouser] 📥 Depositing ${quantity}x ${itemType} to chest at ${JSON.stringify(chestPosition)}`);

      // 移动到箱子位置
      await this.moveTo(chestPosition);

      // 打开箱子
      const chest = await this.openChest(chestPosition);
      if (!chest) {
        throw new Error('Failed to open chest');
      }

      // 放入物品
      const item = this.bot.inventory.items().find(item => item.name === itemType);
      if (!item) {
        throw new Error(`Item ${itemType} not found in bot inventory`);
      }

      const toDeposit = Math.min(quantity, item.count);
      await chest.deposit(item.type, null, toDeposit);

      // 关闭箱子
      chest.close();

      console.log(`[Warehouser] ✅ Deposited ${toDeposit}x ${itemType}`);
      return { itemType, quantity: toDeposit };

    } catch (error) {
      console.error(`[Warehouser] ❌ Deposit failed: ${error.message}`);
      return null;
    } finally {
      this.isBusy = false;
      this.currentAction = null;
    }
  }

  /**
   * 从背包中移动物品到箱子
   * @param {string} itemType - 物品类型
   * @param {number} quantity - 数量
   * @param {Object} chestPosition - 箱子位置
   */
  async moveInventoryToChest(itemType, quantity, chestPosition) {
    return await this.depositToChest(chestPosition, itemType, quantity);
  }

  /**
   * 从箱子移动物品到背包
   * @param {Object} chestPosition - 箱子位置
   * @param {string} itemType - 物品类型
   * @param {number} quantity - 数量
   */
  async moveChestToInventory(chestPosition, itemType, quantity) {
    return await this.withdrawFromChest(chestPosition, itemType, quantity);
  }

  /**
   * 打开箱子
   */
  async openChest(chestPosition) {
    const chestBlock = this.bot.blockAt(chestPosition);

    if (!chestBlock || chestBlock.name !== 'chest') {
      console.error(`[Warehouser] No chest at ${JSON.stringify(chestPosition)}`);
      return null;
    }

    try {
      const chest = await this.bot.openChest(chestBlock);
      return chest;
    } catch (error) {
      console.error(`[Warehouser] Failed to open chest: ${error.message}`);
      return null;
    }
  }

  /**
   * 获取当前状态
   */
  getStatus() {
    return {
      username: this.bot.username,
      isBusy: this.isBusy,
      currentAction: this.currentAction,
      position: this.bot.entity.position,
      inventory: this.bot.inventory.items()
    };
  }

  /**
   * 等待空闲
   */
  async waitUntilIdle() {
    while (this.isBusy) {
      await this.sleep(100);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { WarehouserBot };
```

---

## 5. AI 调度器 (智能决策层)

**文件**: `ai/warehouseScheduler.js`

**职责**:
- 决定搬运什么物品
- 决定从哪里搬运到哪里
- 优化搬运路径
- 分配任务给仓库员

**代码实现**:

```javascript
/**
 * AI 仓库调度器
 * 负责所有智能决策和任务编排
 */
class WarehouseScheduler {
  constructor(warehouseManager, warehouserBot) {
    this.warehouseManager = warehouseManager;
    this.warehouser = warehouserBot;
    this.taskQueue = [];
    this.isProcessing = false;

    console.log('[Scheduler] AI Scheduler initialized');
  }

  /**
   * 任务：从输入仓库搬运到分类仓库
   * @param {string} inputId - 输入仓库ID
   * @param {string} sortingId - 分类仓库ID
   * @param {Array} items - 物品列表 ['all'] 或 ['oak_log', 'stone']
   */
  async transferInputToSorting(inputId, sortingId, items = ['all']) {
    console.log(`[Scheduler] 📦 Planning task: ${inputId} → ${sortingId}`);

    const inputWarehouse = this.warehouseManager.getWarehouse(inputId);
    const sortingWarehouse = this.warehouseManager.getWarehouse(sortingId);

    if (!inputWarehouse || !sortingWarehouse) {
      console.error(`[Scheduler] ❌ Warehouse not found`);
      return false;
    }

    // 决定要搬运的物品
    const itemsToMove = items[0] === 'all'
      ? inputWarehouse.getAllItems()
      : inputWarehouse.getItems(items);

    console.log(`[Scheduler] Items to move: ${JSON.stringify(itemsToMove)}`);

    // 执行搬运
    for (const { item, quantity } of itemsToMove) {
      await this.moveItemBetweenWarehouses(
        inputWarehouse,
        sortingWarehouse,
        item,
        quantity
      );
    }

    console.log(`[Scheduler] ✅ Task completed: ${inputId} → ${sortingId}`);
    return true;
  }

  /**
   * 任务：智能调度到输出仓库
   * @param {string} outputId - 输出仓库ID
   * @param {Object} requiredItems - 所需物品 {item: quantity}
   */
  async smartDispatchToOutput(outputId, requiredItems) {
    console.log(`[Scheduler] 🎯 Planning smart dispatch to ${outputId}`);
    console.log(`[Scheduler] Required items: ${JSON.stringify(requiredItems)}`);

    const outputWarehouse = this.warehouseManager.getWarehouse(outputId);
    if (!outputWarehouse) {
      console.error(`[Scheduler] ❌ Output warehouse not found`);
      return false;
    }

    // 检查当前库存
    const currentInventory = outputWarehouse.getInventory();

    // 计算缺失物品
    const missingItems = this.calculateMissingItems(currentInventory, requiredItems);
    console.log(`[Scheduler] Missing items: ${JSON.stringify(missingItems)}`);

    if (missingItems.length === 0) {
      console.log(`[Scheduler] ✅ All items already in ${outputId}`);
      return true;
    }

    // 从所有仓库收集缺失物品
    const allWarehouses = this.warehouseManager.getAllWarehouses();

    for (const { item, quantity } of missingItems) {
      let remaining = quantity;

      // 优先从分类仓库查找
      for (const [whId, warehouse] of Object.entries(allWarehouses)) {
        if (whId === outputId) continue;
        if (remaining <= 0) break;

        const inventory = warehouse.getInventory();
        const available = inventory[item] || 0;

        if (available > 0) {
          const toMove = Math.min(remaining, available);
          await this.moveItemBetweenWarehouses(
            warehouse,
            outputWarehouse,
            item,
            toMove
          );
          remaining -= toMove;
        }
      }
    }

    console.log(`[Scheduler] ✅ Smart dispatch completed`);
    return true;
  }

  /**
   * 核心搬运逻辑：在两个仓库间搬运物品
   */
  async moveItemBetweenWarehouses(sourceWarehouse, destWarehouse, itemType, quantity) {
    console.log(`[Scheduler] 🔄 Moving ${quantity}x ${itemType}: ${sourceWarehouse.id} → ${destWarehouse.id}`);

    // 1. 找到源箱子
    const sourceChest = sourceWarehouse.findChestWithItem(itemType);
    if (!sourceChest) {
      console.log(`[Scheduler] ⚠️  No ${itemType} found in ${sourceWarehouse.id}`);
      return false;
    }

    // 2. 找到目标箱子
    const destChest = destWarehouse.findChestForItem(itemType);
    if (!destChest) {
      console.log(`[Scheduler] ⚠️  No space in ${destWarehouse.id}`);
      return false;
    }

    // 3. 等待仓库员空闲
    await this.warehouser.waitUntilIdle();

    // 4. 执行取物
    const withdrawn = await this.warehouser.withdrawFromChest(
      sourceChest.position,
      itemType,
      quantity
    );

    if (!withdrawn) {
      console.log(`[Scheduler] ⚠️  Failed to withdraw ${itemType}`);
      return false;
    }

    // 5. 执行放物
    const deposited = await this.warehouser.depositToChest(
      destChest.position,
      itemType,
      withdrawn.quantity
    );

    if (!deposited) {
      console.log(`[Scheduler] ⚠️  Failed to deposit ${itemType}`);
      // 尝试退回
      await this.warehouser.depositToChest(sourceChest.position, itemType, withdrawn.quantity);
      return false;
    }

    // 6. 更新仓库库存
    sourceWarehouse.updateItem(itemType, -withdrawn.quantity);
    destWarehouse.updateItem(itemType, deposited.quantity);

    console.log(`[Scheduler] ✅ Moved ${deposited.quantity}x ${itemType}`);
    return true;
  }

  /**
   * 计算缺失物品
   */
  calculateMissingItems(currentInventory, requiredItems) {
    const missing = [];

    for (const [item, targetQuantity] of Object.entries(requiredItems)) {
      const currentQuantity = currentInventory[item] || 0;
      const missingQuantity = Math.max(0, targetQuantity - currentQuantity);

      if (missingQuantity > 0) {
        missing.push({ item, quantity: missingQuantity });
      }
    }

    return missing;
  }

  /**
   * 优化路径规划
   */
  async planOptimalRoute(sourceIds, destId, requiredItems) {
    // TODO: 实现更复杂的路径优化算法
    // 例如：TSP (旅行商问题) 最短路径
    console.log(`[Scheduler] 🗺️  Planning optimal route...`);
    return sourceIds; // 简单实现：按顺序
  }

  /**
   * 获取状态
   */
  getStatus() {
    return {
      isProcessing: this.isProcessing,
      taskQueue: this.taskQueue.length,
      warehouserStatus: this.warehouser.getStatus()
    };
  }
}

module.exports = { WarehouseScheduler };
```

---

## 5. 原型测试脚本

**文件**: `prototype/test.js`

**功能**:
- 集成所有组件
- 运行完整测试流程
- 输出测试结果

**代码实现**:

```javascript
/**
 * 原型测试主脚本
 */

const { RandomItemGenerator } = require('../simulation/randomItemGenerator');
const { InventoryStatistics } = require('../simulation/inventoryStatistics');
const { SuccessValidator } = require('../simulation/successValidator');
const { WarehouseManager } = require('../core/warehouseManager');
const { WarehouserBot } = require('../bots/warehouserBot');

// 创建 Mineflayer bot (需要真实 Minecraft 服务器)
const mineflayer = require('mineflayer');

async function main() {
  console.log('🚀 物流系统原型测试启动\n');

  // 1. 创建 bot 实例
  const bot = mineflayer.createBot({
    host: 'localhost',
    port: 25565,
    username: 'WarehouserBot1'
  });

  bot.on('spawn', () => {
    console.log('✅ Bot 已连接到服务器\n');
    startTest(bot);
  });

  bot.on('error', (err) => {
    console.error('❌ Bot 连接错误:', err);
  });
}

function startTest(bot) {
  // 2. 初始化仓库管理器
  const warehouseManager = new WarehouseManager();

  // 创建测试仓库
  warehouseManager.createWarehouse({
    id: 'input_warehouse_1',
    type: 'input',
    location: { x: 0, y: 64, z: 0 },
    chests: [
      { id: 'chest_1', position: { x: 0, y: 64, z: 0 } }
    ]
  });

  warehouseManager.createWarehouse({
    id: 'sorting_warehouse_1',
    type: 'sorting',
    location: { x: 10, y: 64, z: 0 },
    categories: {
      'wood': { chestId: 'chest_1' },
      'stone': { chestId: 'chest_2' },
      'ores': { chestId: 'chest_3' }
    }
  });

  warehouseManager.createWarehouse({
    id: 'output_warehouse_1',
    type: 'output',
    location: { x: 20, y: 64, z: 0 },
    materials: {
      'oak_planks': { chestId: 'chest_1' },
      'cobblestone': { chestId: 'chest_2' }
    }
  });

  console.log('✅ 仓库系统初始化完成\n');

  // 3. 初始化模拟器
  const randomGenerator = new RandomItemGenerator(warehouseManager);
  const statistics = new InventoryStatistics(warehouseManager);
  const validator = new SuccessValidator(warehouseManager);

  // 4. 设置成功目标
  validator.setTarget(
    'output_warehouse_1',
    {
      'oak_planks': 192,
      'cobblestone': 256
    },
    (warehouseId, result) => {
      console.log('\n' + '='.repeat(80));
      console.log('🎉 原型测试成功!');
      console.log('='.repeat(80));
      console.log(JSON.stringify(result.details, null, 2));
      console.log('='.repeat(80) + '\n');

      // 停止生成器
      randomGenerator.stop();
    }
  );

  // 5. 初始化仓库员
  const warehouser = new WarehouserBot(bot, warehouseManager);

  // 6. 启动模拟
  console.log('🎮 开始模拟...\n');

  randomGenerator.start();

  // 定期打印报告
  setInterval(() => {
    statistics.printReport();
    validator.printProgress('output_warehouse_1');
  }, 30000); // 每30秒

  // 仓库员任务调度
  setInterval(async () => {
    // 任务1: 输入 → 分类
    await warehouser.transferInputToSorting(
      'input_warehouse_1',
      'sorting_warehouse_1',
      ['all']
    );

    // 任务2: 所有仓库 → 输出 (智能调度)
    await warehouser.smartDispatchToOutput(
      'output_warehouse_1',
      {
        'oak_planks': 192,
        'cobblestone': 256
      }
    );

    // 验证目标
    validator.validate('output_warehouse_1');

  }, 15000); // 每15秒
}

// 启动测试
main();
```

---

## 6. 测试流程

### 6.1 启动步骤

```bash
# 1. 启动 Minecraft 服务器 (需要真实的 MC 服务器)
# 确保箱子已放置在正确位置

# 2. 运行原型测试
node prototype/test.js
```

### 6.2 预期输出

```
🚀 物流系统原型测试启动

✅ Bot 已连接到服务器

✅ 仓库系统初始化完成

[RandomItemGenerator] Starting random item generation...
[RandomItemGenerator] ✅ Added 32x oak_log to input warehouse
[RandomItemGenerator] ✅ Added 16x cobblestone to input warehouse
[RandomItemGenerator] ✅ Added 8x coal to input warehouse

🎮 开始模拟...

[Warehouser] 📦 Starting task: input_warehouse_1 → sorting_warehouse_1
[Warehouser] 📤 Withdrew 32x oak_log from input_warehouse_1
[Warehouser] 📥 Deposited 32x oak_log to sorting_warehouse_1 (category: wood)
[Warehouser] ✅ Task completed

[Warehouser] 🎯 Smart dispatch to output_warehouse_1
[Warehouser] Required items: {"oak_planks":192,"cobblestone":256}
[Warehouser] Missing items: [{"item":"oak_planks","quantity":192},{"item":"cobblestone","quantity":256}]

...

🎯 目标进度: output_warehouse_1
------------------------------------------------------------
oak_planks              [███████░░░░░░░░░░░░░░░] 32/192
cobblestone             [███░░░░░░░░░░░░░░░░░░] 16/256
------------------------------------------------------------
⏳ 进行中...

...

🎉 原型测试成功!
================================================================================
✅ 目标完成!
```

---

## 7. 文件结构

```
logistics-prototype/
├── prototype/
│   └── test.js                    # 主测试脚本
├── simulation/
│   ├── randomItemGenerator.js    # 随机物品生成器
│   ├── inventoryStatistics.js    # 库存统计器
│   └── successValidator.js       # 成功验证器
├── bots/
│   └── warehouserBot.js          # 仓库员实现
├── core/
│   └── warehouseManager.js       # 仓库管理器
└── config/
    └── prototype-warehouses.json # 仓库配置
```

---

## 8. 仓库建模与搭建

### 8.1 setblock 建造模式

**核心思路**: 使用 Chat 命令发送 `/setblock` 逐个建造箱子

```
Bot ──chat──▶ /setblock x y z chest ──▶ 放置一个箱子
     重复88次 → 完整仓库 (2×11×4)
```

### 8.2 仓库结构定义

**标准仓库尺寸**: 宽2 × 长11 × 高4 (箱子单位)

```
┌─────────────────────────────────────┐
│  仓库结构: 2x11x4 箱子矩阵            │
├─────────────────────────────────────┤
│                                      │
│  侧面图 (高4, 长11):                 │
│                                      │
│     ████  ← 第4层                    │
│     ████  ← 第3层                    │
│     ████  ← 第2层                    │
│     ████  ← 第1层 (地面)             │
│                                      │
│  俯视图 (宽2, 长11):                 │
│  ┌─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┐           │
│  │ │ │ │ │ │ │ │ │ │ │ │ ← 宽2格    │
│  ├─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┤           │
│  │ │ │ │ │ │ │ │ │ │ │ │           │
│  └─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┘           │
│    ↑                             ↑   │
│   起点                          终点  │
│    长11格                           │
│                                      │
│  总箱子数: 2 × 11 × 4 = 88个箱子     │
└─────────────────────────────────────┘
```

### 8.3 仓库建模类 (使用 setblock)

**文件**: `core/warehouseBuilder.js`

```javascript
/**
 * 仓库建造者
 * 通过 /setblock 命令逐个建造箱子
 */
class WarehouseBuilder {
  constructor(bot) {
    this.bot = bot;

    // 标准仓库尺寸
    this.STANDARD_SIZE = {
      width: 2,
      length: 11,
      height: 4
    };

    console.log('[WarehouseBuilder] Builder initialized');
  }

  /**
   * 建造完整仓库
   * @param {string} warehouseId - 仓库ID
   * @param {string} type - 仓库类型 (input/sorting/output)
   * @param {Object} position - 起始位置 {x, y, z}
   * @param {string} direction - 朝向
   */
  async buildWarehouse(warehouseId, type, position, direction = 'east') {
    const size = this.STANDARD_SIZE;

    console.log(`[WarehouseBuilder] 🏗️  Building warehouse: ${warehouseId}`);
    console.log(`[WarehouseBuilder] Type: ${type}`);
    console.log(`[WarehouseBuilder] Position: ${JSON.stringify(position)}`);
    console.log(`[WarehouseBuilder] Direction: ${direction}`);
    console.log(`[WarehouseBuilder] Size: ${size.width}x${size.length}x${size.height}`);

    // 传送到建造位置附近
    await this.tpToBuildPosition(position, direction);

    const chestPositions = [];
    const widthVec = this.getDirectionVector(
      direction === 'east' || direction === 'west' ? 'north' : 'east'
    );
    const lengthVec = this.getDirectionVector(direction);

    // 遍历每一层
    for (let y = 0; y < size.height; y++) {
      console.log(`[WarehouseBuilder] 🏗️  Building layer ${y + 1}/${size.height}...`);

      // 遍历宽度方向
      for (let w = 0; w < size.width; w++) {
        // 遍历长度方向
        for (let l = 0; l < size.length; l++) {
          // 计算箱子位置
          const chestPos = {
            x: position.x + (lengthVec.x * l) + (widthVec.x * w),
            y: position.y + y,
            z: position.z + (lengthVec.z * l) + (widthVec.z * w)
          };

          // 发送 setblock 命令
          this.bot.chat(`/setblock ${chestPos.x} ${chestPos.y} ${chestPos.z} chest`);

          chestPositions.push({
            ...chestPos,
            direction,
            index: chestPositions.length
          });

          // 延迟避免命令过快
          await this.sleep(50); // 每50ms一个箱子

          // 每层完成后打印进度
          if (chestPositions.length % 22 === 0) {
            console.log(`[WarehouseBuilder] ✅ ${chestPositions.length}/${size.width * size.length * size.height} chests placed`);
          }
        }
      }
    }

    console.log(`[WarehouseBuilder] ✅ Warehouse complete: ${chestPositions.length} chests`);

    return {
      id: warehouseId,
      type,
      location: position,
      direction,
      size: size,
      chestPositions: chestPositions,
      totalCapacity: chestPositions.length * 27,
      chestCount: chestPositions.length
    };
  }

  /**
   * 扫描现有仓库
   */
  async scanWarehouse(startPos, direction, size) {
    console.log(`[WarehouseBuilder] 🔍 Scanning warehouse at ${JSON.stringify(startPos)}...`);

    const chestPositions = [];
    const widthVec = this.getDirectionVector(
      direction === 'east' || direction === 'west' ? 'north' : 'east'
    );
    const lengthVec = this.getDirectionVector(direction);

    for (let y = 0; y < size.height; y++) {
      for (let w = 0; w < size.width; w++) {
        for (let l = 0; l < size.length; l++) {
          const checkPos = {
            x: startPos.x + (lengthVec.x * l) + (widthVec.x * w),
            y: startPos.y + y,
            z: startPos.z + (lengthVec.z * l) + (widthVec.z * w)
          };

          const block = this.bot.blockAt(checkPos);

          if (block && block.name === 'chest') {
            chestPositions.push({
              ...checkPos,
              index: chestPositions.length
            });
          }
        }
      }
    }

    console.log(`[WarehouseBuilder] ✅ Scan complete: ${chestPositions.length}/${size.width * size.length * size.height} chests found`);

    return {
      chestPositions,
      totalCapacity: chestPositions.length * 27,
      chestCount: chestPositions.length
    };
  }

  /**
   * 获取方向向量
   */
  getDirectionVector(direction) {
    const vectors = {
      'north': { x: 0, z: -1 },
      'south': { x: 0, z: 1 },
      'east': { x: 1, z: 0 },
      'west': { x: -1, z: 0 }
    };

    return vectors[direction] || vectors['east'];
  }

  /**
   * 传送到建造位置附近
   * 确保在 setblock 命令的有效范围内
   */
  async tpToBuildPosition(position, direction) {
    const offset = this.getDirectionVector(direction);
    const tpPos = {
      x: position.x + offset.x * 3,
      y: position.y + 2, // 稍微高一点，便于观察
      z: position.z + offset.z * 3
    };

    console.log(`[WarehouseBuilder] 🚀 Teleporting to build position: ${JSON.stringify(tpPos)}`);
    this.bot.chat(`/tp ${this.bot.username} ${tpPos.x} ${tpPos.y} ${tpPos.z}`);

    // 等待传送完成
    await this.sleep(1000);
  }

  /**
   * 延迟函数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { WarehouseBuilder };
```

### 8.4 Chat命令快速搭建

**文件**: `commands/warehouseCommands.js`

```javascript
/**
 * 仓库建造命令
 * 通过Chat快速搭建仓库
 */
class WarehouseCommands {
  constructor(warehouseManager, warehouseBuilder) {
    this.warehouseManager = warehouseManager;
    this.builder = warehouseBuilder;
  }

  /**
   * 注册所有命令
   */
  registerCommands(bot) {
    bot.on('chat', (username, message) => {
      const [command, ...args] = message.split(' ');

      switch (command) {
        case '!build':
          this.handleBuild(bot, args);
          break;

        case '!scan':
          this.handleScan(bot, args);
          break;

        case '!list':
          this.handleList(bot);
          break;

        case '!start':
          this.handleStart(bot);
          break;

        case '!help':
          this.handleHelp(bot);
          break;

        default:
          break;
      }
    });

    console.log('[WarehouseCommands] Chat commands registered');
  }

  /**
   * 建造仓库命令
   * 用法: !build <type> <id> <x> <y> <z> [direction]
   * 示例: !build input input_1 100 64 200 east
   */
  async handleBuild(bot, args) {
    if (args.length < 5) {
      bot.chat('❌ 用法: !build <type> <id> <x> <y> <z> [direction]');
      bot.chat('   类型: input, sorting, output');
      bot.chat('   方向: north, south, east, west (默认: east)');
      return;
    }

    const [type, id, x, y, z, direction = 'east'] = args;

    bot.chat(`🏗️  开始建造 ${type} 仓库: ${id}...`);
    bot.chat(`   位置: ${x}, ${y}, ${z}`);
    bot.chat(`   方向: ${direction}`);
    bot.chat(`   尺寸: 2×11×4 (88个箱子)`);

    try {
      // 通过 setblock 命令建造
      const metadata = await this.builder.buildWarehouse(
        id,
        type,
        { x: parseInt(x), y: parseInt(y), z: parseInt(z) },
        direction
      );

      // 在仓库管理器中注册
      this.warehouseManager.createWarehouse({
        id,
        type,
        location: metadata.location,
        direction,
        chestPositions: metadata.chestPositions,
        totalCapacity: metadata.totalCapacity
      });

      bot.chat(`✅ 仓库建造完成!`);
      bot.chat(`   箱子数量: ${metadata.chestCount}`);
      bot.chat(`   总容量: ${metadata.totalCapacity} 物品格`);

    } catch (error) {
      bot.chat(`❌ 建造失败: ${error.message}`);
    }
  }

  /**
   * 扫描仓库命令
   */
  async handleScan(bot, args) {
    if (args.length < 5) {
      bot.chat('❌ 用法: !scan <id> <x> <y> <z> <direction>');
      return;
    }

    const [id, x, y, z, direction] = args;

    bot.chat(`🔍 扫描仓库: ${id}...`);

    try {
      const result = await this.builder.scanWarehouse(
        { x: parseInt(x), y: parseInt(y), z: parseInt(z) },
        direction,
        this.builder.STANDARD_SIZE
      );

      if (result.chestPositions.length === 0) {
        bot.chat(`⚠️  未找到箱子结构`);
        return;
      }

      this.warehouseManager.createWarehouse({
        id,
        type: 'unknown',
        location: { x: parseInt(x), y: parseInt(y), z: parseInt(z) },
        direction,
        chestPositions: result.chestPositions,
        totalCapacity: result.totalCapacity
      });

      bot.chat(`✅ 扫描完成:`);
      bot.chat(`   箱子数量: ${result.chestCount}`);
      bot.chat(`   总容量: ${result.totalCapacity} 物品格`);

    } catch (error) {
      bot.chat(`❌ 扫描失败: ${error.message}`);
    }
  }

  /**
   * 列出所有仓库
   */
  handleList(bot) {
    const warehouses = this.warehouseManager.getAllWarehouses();
    const count = Object.keys(warehouses).length;

    bot.chat(`📋 仓库列表 (${count} 个):`);

    for (const [id, wh] of Object.entries(warehouses)) {
      const pos = wh.location;
      const inv = wh.getInventory();
      const itemCount = Object.values(inv).reduce((sum, qty) => sum + qty, 0);

      bot.chat(`   ${id} (${wh.type})`);
      bot.chat(`      位置: ${pos.x}, ${pos.y}, ${pos.z}`);
      bot.chat(`      物品: ${itemCount}/${wh.getTotalCapacity()}`);
    }
  }

  /**
   * 显示帮助
   */
  handleHelp(bot) {
    bot.chat('📖 仓库命令:');
    bot.chat('   !build <type> <id> <x> <y> <z> [direction]');
    bot.chat('   !scan <id> <x> <y> <z> <direction>');
    bot.chat('   !list');
    bot.chat('   !start');
    bot.chat('   !help');
  }

  /**
   * 启动模拟
   */
  handleStart(bot) {
    bot.chat('🚀 启动模拟...');
    if (this.onStartCallback) {
      this.onStartCallback();
    }
  }

  setOnStart(callback) {
    this.onStartCallback = callback;
  }
}

module.exports = { WarehouseCommands };
```

### 8.5 更新测试脚本

```javascript
/**
 * 原型测试主脚本 (更新版)
 */

const { RandomItemGenerator } = require('../simulation/randomItemGenerator');
const { InventoryStatistics } = require('../simulation/inventoryStatistics');
const { SuccessValidator } = require('../simulation/successValidator');
const { WarehouseManager } = require('../core/warehouseManager');
const { WarehouserBot } = require('../bots/warehouserBot');
const { WarehouseScheduler } = require('../ai/warehouseScheduler');
const { WarehouseBuilder } = require('../core/warehouseBuilder');
const { WarehouseCommands } = require('../commands/warehouseCommands');

const mineflayer = require('mineflayer');

async function main() {
  console.log('🚀 物流系统原型测试启动\n');

  const bot = mineflayer.createBot({
    host: 'localhost',
    port: 25565,
    username: 'WarehouserBot1'
  });

  bot.on('spawn', () => {
    console.log('✅ Bot 已连接到服务器\n');
    startTest(bot);
  });

  bot.on('error', (err) => {
    console.error('❌ Bot 连接错误:', err);
  });
}

function startTest(bot) {
  const warehouseManager = new WarehouseManager();
  const warehouseBuilder = new WarehouseBuilder(bot);
  const warehouseCommands = new WarehouseCommands(warehouseManager, warehouseBuilder);

  warehouseCommands.registerCommands(bot);

  const randomGenerator = new RandomItemGenerator(warehouseManager);
  const statistics = new InventoryStatistics(warehouseManager);
  const validator = new SuccessValidator(warehouseManager);

  // 创建仓库员 (执行器)
  const warehouser = new WarehouserBot(bot, warehouseManager);

  // 创建 AI 调度器 (智能决策层)
  const scheduler = new WarehouseScheduler(warehouseManager, warehouser);

  console.log('✅ 系统初始化完成\n');
  console.log('📖 使用命令:');
  console.log('   !build input input_1 <x> <y> <z> east');
  console.log('   !build sorting sorting_1 <x> <y> <z> east');
  console.log('   !build output output_1 <x> <y> <z> east');
  console.log('   !list');
  console.log('   !start\n');

  bot.chat('✅ 物流系统就绪! 使用 !help 查看命令');

  warehouseCommands.setOnStart(() => {
    startSimulation(bot, warehouseManager, randomGenerator, statistics, validator, scheduler);
  });
}

function startSimulation(bot, warehouseManager, randomGenerator, statistics, validator, scheduler) {
  console.log('🎮 开始模拟...\n');
  bot.chat('🎮 模拟开始!');

  validator.setTarget('output_1', {
    'oak_planks': 192,
    'cobblestone': 256
  }, (warehouseId, result) => {
    console.log('\n🎉 原型测试成功!');
    bot.chat('🎉 测试成功!');
    randomGenerator.stop();
  });

  randomGenerator.start();

  setInterval(() => {
    statistics.printReport();
    validator.printProgress('output_1');
  }, 30000);

  // 使用调度器执行任务
  setInterval(async () => {
    // 任务1: 输入 → 分类
    await scheduler.transferInputToSorting('input_1', 'sorting_1', ['all']);

    // 任务2: 所有仓库 → 输出
    await scheduler.smartDispatchToOutput('output_1', {
      'oak_planks': 192,
      'cobblestone': 256
    });

    // 验证目标
    validator.validate('output_1');
  }, 15000);
}

main();
```

---

## 9. 快速搭建示例

### 操作步骤

```bash
# 1. 启动测试脚本
node prototype/test.js

# 2. 在游戏中执行命令

# 建造输入仓库 (会自动发送88个setblock命令)
!build input input_1 100 64 200 east

# 建造分类仓库
!build sorting sorting_1 110 64 200 east

# 建造输出仓库
!build output output_1 120 64 200 east

# 查看所有仓库
!list

# 开始模拟
!start
```

### 预期输出

```
[WarehouserBot1] 🏗️  开始建造 input 仓库: input_1...
[WarehouserBot1]    位置: 100, 64, 200
[WarehouserBot1]    方向: east
[WarehouserBot1]    尺寸: 2×11×4 (88个箱子)
[WarehouseBuilder] 🚀 Teleporting to build position: {"x":103,"y":66,"z":200}
[WarehouseBuilder] 🏗️  Building layer 1/4...
[WarehouseBuilder] ✅ 22/88 chests placed
[WarehouseBuilder] 🏗️  Building layer 2/4...
[WarehouseBuilder] ✅ 44/88 chests placed
[WarehouseBuilder] 🏗️  Building layer 3/4...
[WarehouseBuilder] ✅ 66/88 chests placed
[WarehouseBuilder] 🏗️  Building layer 4/4...
[WarehouseBuilder] ✅ 88/88 chests placed
[WarehouseBuilder] ✅ Warehouse complete: 88 chests
[WarehouserBot1] ✅ 仓库建造完成!
[WarehouserBot1]    箱子数量: 88
[WarehouserBot1]    总容量: 2376 物品格
```

### 传送位置计算逻辑

```
仓库起点: (100, 64, 200)
方向: east (向东方延伸)

传送位置:
  x = 100 + 1×3 = 103  (东方3格)
  y = 64 + 2 = 66     (上方2格)
  z = 200 + 0×3 = 200 (不变)

最终传送: /tp WarehouserBot1 103 66 200
```

这样可以确保：
1. ✅ Bot 在 setblock 有效范围内
2. ✅ 有良好的视野观察建造过程
3. ✅ 不会阻挡箱子放置

---

## 10. 文件结构更新

```
logistics-prototype/
├── prototype/
│   └── test.js                    # 主测试脚本
├── simulation/
│   ├── randomItemGenerator.js
│   ├── inventoryStatistics.js
│   └── successValidator.js
├── bots/
│   └── warehouserBot.js          # 纯执行器 (移动、取、放)
├── ai/
│   └── warehouseScheduler.js     # AI调度器 (智能决策)
├── core/
│   ├── warehouseManager.js
│   └── warehouseBuilder.js       # setblock 建造
├── commands/
│   └── warehouseCommands.js      # Chat命令
└── config/
    └── prototype-warehouses.json
```

---

## 11. 架构分层

```
┌─────────────────────────────────────────────────────────┐
│                    AI 调度层                    │
│  - 决定搬运什么物品                                       │
│  - 决定从哪里到哪里                                       │
│  - 路径优化和任务编排                                      │
└────────────────────────┬───────────────────────────────┘
                         │ 指令
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   仓库员执行层                   │
│  - moveTo(x, y, z)           移动到位置                   │
│  - withdrawFromChest(...)    从箱子取出                   │
│  - depositToChest(...)       放入箱子                     │
└────────────────────────┬───────────────────────────────┘
                         │ 动作
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   Minecraft 世界                         │
│  - 箱子、物品、位置等游戏对象                              │
└─────────────────────────────────────────────────────────┘
```

---

## 12. 使用示例

### 调度器使用

```javascript
// 创建仓库员和调度器
const warehouser = new WarehouserBot(bot, warehouseManager);
const scheduler = new WarehouseScheduler(warehouseManager, warehouser);

// 调度器自动决策并执行
await scheduler.transferInputToSorting('input_1', 'sorting_1', ['all']);

// 调度器智能收集物品
await scheduler.smartDispatchToOutput('output_1', {
  'oak_planks': 192,
  'cobblestone': 256
});
```

### 仓库员直接使用 (低级API)

```javascript
// 直接控制仓库员 (不推荐，仅供高级使用)
const warehouser = new WarehouserBot(bot, warehouseManager);

// 手动执行每个步骤
await warehouser.withdrawFromChest(
  {x: 100, y: 64, z: 200},  // 箱子位置
  'oak_log',                  // 物品
  64                          // 数量
);

await warehouser.depositToChest(
  {x: 110, y: 64, z: 200},  // 目标箱子
  'oak_log',                  // 物品
  64                          // 数量
);
```

---

## 13. 下一步

1. ✅ **实现核心代码** (上述所有文件)
2. ✅ **添加仓库建模与setblock建造**
3. ✅ **重构仓库员为纯执行器**
4. ✅ **创建AI调度器**
5. ⏳ **在真实 Minecraft 环境测试**
6. ⏳ **优化调度算法和路径规划**

---

**文档版本**: v0.3-alpha
**作者**: Claude Code
**状态**: 添加AI调度器，架构重构完成
**更新日期**: 2026-03-23
