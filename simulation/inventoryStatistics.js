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
