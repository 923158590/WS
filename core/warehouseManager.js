/**
 * 仓库管理器
 * 管理所有仓库实例
 */

class WarehouseManager {
  constructor() {
    this.warehouses = new Map();
    console.log('[WarehouseManager] Initialized');
  }

  /**
   * 创建新仓库
   */
  createWarehouse(config) {
    const {
      id,
      type,
      location,
      direction = 'east',
      chestPositions = [],
      categories = null,
      materials = null
    } = config;

    const warehouse = new Warehouse({
      id,
      type,
      location,
      direction,
      chestPositions,
      categories,
      materials
    });

    this.warehouses.set(id, warehouse);
    console.log(`[WarehouseManager] ✅ Created warehouse: ${id} (${type})`);

    return warehouse;
  }

  /**
   * 获取仓库
   */
  getWarehouse(id) {
    return this.warehouses.get(id);
  }

  /**
   * 获取所有仓库
   */
  getAllWarehouses() {
    return Object.fromEntries(this.warehouses);
  }

  /**
   * 删除仓库
   */
  removeWarehouse(id) {
    const result = this.warehouses.delete(id);
    if (result) {
      console.log(`[WarehouseManager] 🗑️  Removed warehouse: ${id}`);
    }
    return result;
  }
}

/**
 * 仓库类
 */
class Warehouse {
  constructor(config) {
    this.id = config.id;
    this.type = config.type; // 'input' | 'sorting' | 'output'
    this.location = config.location;
    this.direction = config.direction;
    this.chestPositions = config.chestPositions || [];
    this.categories = config.categories; // 分类仓库使用
    this.materials = config.materials;   // 输出仓库使用

    // 本地库存缓存
    this.inventoryCache = new Map();
  }

  /**
   * 存入物品
   */
  depositItem(itemType, quantity) {
    const current = this.inventoryCache.get(itemType) || 0;
    this.inventoryCache.set(itemType, current + quantity);

    console.log(`[${this.id}] 📥 Deposited ${quantity}x ${itemType} (total: ${current + quantity})`);
    return true;
  }

  /**
   * 取出物品
   */
  withdrawItem(itemType, quantity) {
    const current = this.inventoryCache.get(itemType) || 0;

    if (current < quantity) {
      console.log(`[${this.id}] ⚠️  Insufficient ${itemType}: ${current}/${quantity}`);
      return false;
    }

    this.inventoryCache.set(itemType, current - quantity);
    console.log(`[${this.id}] 📤 Withdrew ${quantity}x ${itemType} (remaining: ${current - quantity})`);
    return true;
  }

  /**
   * 更新物品数量
   */
  updateItem(itemType, delta) {
    const current = this.inventoryCache.get(itemType) || 0;
    const newQuantity = current + delta;

    if (newQuantity <= 0) {
      this.inventoryCache.delete(itemType);
    } else {
      this.inventoryCache.set(itemType, newQuantity);
    }

    return newQuantity;
  }

  /**
   * 获取库存
   */
  getInventory() {
    return Object.fromEntries(this.inventoryCache);
  }

  /**
   * 获取所有物品列表
   */
  getAllItems() {
    return Array.from(this.inventoryCache.entries()).map(([item, quantity]) => ({
      item,
      quantity
    }));
  }

  /**
   * 获取指定物品
   */
  getItems(itemList) {
    const items = [];

    for (const itemType of itemList) {
      const quantity = this.inventoryCache.get(itemType) || 0;
      if (quantity > 0) {
        items.push({ item: itemType, quantity });
      }
    }

    return items;
  }

  /**
   * 找到包含指定物品的箱子
   */
  findChestWithItem(itemType) {
    if (this.chestPositions.length === 0) {
      return null;
    }

    // 简单实现：返回第一个箱子
    // TODO: 实际应该扫描箱子找到包含该物品的箱子
    return {
      position: this.chestPositions[0],
      itemType
    };
  }

  /**
   * 找到可以存放物品的箱子
   */
  findChestForItem(itemType) {
    if (this.chestPositions.length === 0) {
      return null;
    }

    // 简单实现：返回第一个箱子
    // TODO: 根据仓库类型选择合适的箱子
    if (this.type === 'sorting' && this.categories) {
      // 分类仓库：根据物品类型选择对应分类的箱子
      for (const [category, config] of Object.entries(this.categories)) {
        if (itemType.includes(category)) {
          const chestIndex = config.chestId?.replace('chest_', '') || 0;
          return {
            position: this.chestPositions[chestIndex] || this.chestPositions[0],
            itemType
          };
        }
      }
    }

    return {
      position: this.chestPositions[0],
      itemType
    };
  }

  /**
   * 获取总容量
   */
  getTotalCapacity() {
    return this.chestPositions.length * 27; // 每个箱子27格
  }

  /**
   * 获取当前位置已用容量
   */
  getUsedCapacity() {
    const total = Array.from(this.inventoryCache.values())
      .reduce((sum, qty) => sum + qty, 0);
    return total;
  }
}

module.exports = { WarehouseManager, Warehouse };
