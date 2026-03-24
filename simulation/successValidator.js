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
