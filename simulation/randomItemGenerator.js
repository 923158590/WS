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
    const inputWarehouse = this.warehouseManager.getWarehouse('input_1');

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
