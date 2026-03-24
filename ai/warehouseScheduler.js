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
