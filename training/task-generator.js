/**
 * 任务序列生成器
 * 为 OpenClaw 或其他 AI 系统生成任务序列
 */

class TaskGenerator {
  constructor(warehouseManager) {
    this.warehouseManager = warehouseManager;
    this.taskHistory = [];
    this.currentTaskId = 0;
  }

  /**
   * 生成所有可能的任务
   * @returns {Array} 任务列表
   */
  generatePossibleTasks() {
    const tasks = [];
    const warehouses = this.warehouseManager.getAllWarehouses();

    // 扫描输入仓库，生成搬运任务
    for (const [id, wh] of Object.entries(warehouses)) {
      if (wh.type === 'input') {
        const inventory = wh.getInventory();
        const items = Object.entries(inventory)
          .filter(([item, qty]) => qty > 0)
          .map(([item, qty]) => ({ item, quantity: qty }));

        if (items.length > 0) {
          // 生成分类仓库任务
          const sortingWarehouses = Object.entries(warehouses)
            .filter(([_, wh]) => wh.type === 'sorting');

          for (const [sortingId, sortingWh] of sortingWarehouses) {
            // 根据分类仓库的类型匹配合适的物品
            const compatibleItems = this._getCompatibleItems(items, sortingWh);

            if (compatibleItems.length > 0) {
              tasks.push({
                id: this._generateTaskId(),
                type: 'transfer',
                source: id,
                destination: sortingId,
                items: compatibleItems,
                priority: this._calculatePriority(id, sortingId, compatibleItems),
                estimatedReward: this._estimateReward(compatibleItems),
                description: `Transfer items from ${id} to ${sortingId}`
              });
            }
          }
        }
      }
    }

    // 生成输出仓库任务
    const outputWarehouse = warehouses['output_1'];
    if (outputWarehouse) {
      const requiredItems = {
        oak_planks: 192,
        cobblestone: 256
      };

      const currentInventory = outputWarehouse.getInventory();
      const missingItems = [];

      for (const [item, targetQty] of Object.entries(requiredItems)) {
        const currentQty = currentInventory[item] || 0;
        if (currentQty < targetQty) {
          missingItems.push({
            item: item,
            quantity: targetQty - currentQty
          });
        }
      }

      if (missingItems.length > 0) {
        tasks.push({
          id: this._generateTaskId(),
          type: 'dispatch',
          destination: 'output_1',
          requiredItems: missingItems,
          priority: 'high',
          estimatedReward: 50,
          description: `Dispatch missing items to output_1`
        });
      }
    }

    // 按优先级排序
    tasks.sort((a, b) => {
      const priorityScore = { high: 3, medium: 2, low: 1 };
      return priorityScore[b.priority] - priorityScore[a.priority];
    });

    console.log(`[TaskGenerator] Generated ${tasks.length} possible tasks`);
    return tasks;
  }

  /**
   * 为 AI 生成任务序列（专家演示）
   * @param {string} strategy - 策略名称
   * @returns {Array} 任务序列
   */
  generateExpertSequence(strategy = 'balanced') {
    const tasks = this.generatePossibleTasks();
    const sequence = [];

    console.log(`[TaskGenerator] Generating expert sequence with strategy: ${strategy}`);

    switch (strategy) {
      case 'greedy':
        // 贪婪策略：优先执行高奖励任务
        sequence.push(...tasks.filter(t => t.priority === 'high'));
        sequence.push(...tasks.filter(t => t.priority === 'medium'));
        break;

      case 'conservative':
        // 保守策略：先处理简单任务
        sequence.push(...tasks.filter(t => t.priority === 'low'));
        sequence.push(...tasks.filter(t => t.priority === 'medium'));
        sequence.push(...tasks.filter(t => t.priority === 'high'));
        break;

      case 'balanced':
      default:
        // 平衡策略：交替执行不同优先级的任务
        const highTasks = tasks.filter(t => t.priority === 'high');
        const mediumTasks = tasks.filter(t => t.priority === 'medium');
        const lowTasks = tasks.filter(t => t.priority === 'low');

        let i = 0;
        while (highTasks.length > 0 || mediumTasks.length > 0) {
          if (i % 2 === 0 && highTasks.length > 0) {
            sequence.push(highTasks.shift());
          } else if (mediumTasks.length > 0) {
            sequence.push(mediumTasks.shift());
          }
          i++;
        }

        sequence.push(...lowTasks);
        break;
    }

    console.log(`[TaskGenerator] Generated sequence of ${sequence.length} tasks`);
    return sequence;
  }

  /**
   * 记录任务执行历史
   */
  recordTaskExecution(task, result) {
    const record = {
      taskId: task.id,
      task: task,
      result: result,
      timestamp: Date.now(),
      episode: this.currentTaskId++
    };

    this.taskHistory.push(record);

    console.log(`[TaskGenerator] Recorded task execution: ${task.type} (${result.success ? '✅' : '❌'})`);
  }

  /**
   * 导出任务历史（用于训练）
   */
  exportTaskHistory() {
    return {
      totalTasks: this.taskHistory.length,
      successfulTasks: this.taskHistory.filter(r => r.result.success).length,
      failedTasks: this.taskHistory.filter(r => !r.result.success).length,
      history: this.taskHistory,
      exportTime: new Date().toISOString()
    };
  }

  /**
   * 生成训练数据集
   * @param {number} episodes - 要生成的 episode 数量
   */
  generateTrainingDataset(episodes = 100) {
    const dataset = [];

    console.log(`[TaskGenerator] Generating ${episodes} training episodes...`);

    for (let i = 0; i < episodes; i++) {
      const tasks = this.generatePossibleTasks();
      const sequence = this.generateExpertSequence('balanced');

      dataset.push({
        episode: i,
        availableTasks: tasks,
        expertSequence: sequence,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`[TaskGenerator] ✅ Generated ${dataset.length} training episodes`);
    return dataset;
  }

  // ============ 私有方法 ============

  /**
   * 生成唯一任务 ID
   */
  _generateTaskId() {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取与分类仓库兼容的物品
   */
  _getCompatibleItems(items, sortingWarehouse) {
    if (!sortingWarehouse.categories) {
      return items; // 如果没有分类规则，返回所有物品
    }

    // 根据分类规则过滤物品
    const compatibleCategories = sortingWarehouse.categories;
    return items.filter(({ item }) => {
      const category = this._getItemCategory(item);
      return compatibleCategories.includes(category);
    });
  }

  /**
   * 获取物品类别
   */
  _getItemCategory(item) {
    // 简化的物品分类
    const woodItems = ['oak_log', 'birch_log', 'oak_planks', 'birch_planks'];
    const stoneItems = ['stone', 'cobblestone', 'andesite'];
    const foodItems = ['wheat', 'carrot', 'potato', 'bread'];
    const oreItems = ['coal', 'iron_ingot', 'gold_ingot', 'diamond'];

    if (woodItems.some(i => item.includes(i))) return 'wood';
    if (stoneItems.some(i => item.includes(i))) return 'stone';
    if (foodItems.some(i => item.includes(i))) return 'food';
    if (oreItems.some(i => item.includes(i))) return 'ores';

    return 'misc';
  }

  /**
   * 计算任务优先级
   */
  _calculatePriority(sourceId, destId, items) {
    // 简单的优先级计算
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

    if (destId === 'output_1') return 'high';
    if (totalQuantity > 100) return 'high';
    if (totalQuantity > 50) return 'medium';
    return 'low';
  }

  /**
   * 估算奖励
   */
  _estimateReward(items) {
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    return Math.ceil(totalQuantity / 10);
  }
}

module.exports = { TaskGenerator };
