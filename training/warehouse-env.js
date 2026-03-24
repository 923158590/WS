/**
 * 标准化仓库环境接口
 * 用于强化学习或外部 AI 系统训练
 *
 * 设计原则：
 * - 提供清晰的状态空间（Observation Space）
 * - 提供标准的动作空间（Action Space）
 * - 支持重置和步骤执行
 * - 独立于具体 AI 框架
 */

class WarehouseEnv {
  constructor(warehouseManager, warehouserBot, scheduler) {
    this.warehouseManager = warehouseManager;
    this.warehouser = warehouserBot;
    this.scheduler = scheduler;

    // 环境状态
    this.currentEpisode = 0;
    this.currentStep = 0;
    this.maxSteps = 1000;
    this.isDone = false;

    // 奖励累计
    this.episodeReward = 0;
    this.lastReward = 0;

    // 历史记录
    this.history = [];

    console.log('[WarehouseEnv] Standardized training environment initialized');
  }

  /**
   * 重置环境到初始状态
   * @returns {Object} 初始状态
   */
  reset() {
    this.currentEpisode++;
    this.currentStep = 0;
    this.isDone = false;
    this.episodeReward = 0;
    this.lastReward = 0;
    this.history = [];

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[WarehouseEnv] 🔄 Episode ${this.currentEpisode} - Environment Reset`);
    console.log(`${'='.repeat(60)}\n`);

    return this.getState();
  }

  /**
   * 获取当前环境状态（观察空间）
   * @returns {Object} 状态对象
   */
  getState() {
    const warehouses = this.warehouseManager.getAllWarehouses();
    const state = {
      // 时间信息
      episode: this.currentEpisode,
      step: this.currentStep,

      // 仓库状态
      warehouses: {},

      // Bot 状态
      bot: {
        isBusy: this.warehouser.isBusy,
        currentAction: this.warehouser.currentAction,
        position: this.warehouser.bot.entity ? {
          x: Math.floor(this.warehouser.bot.entity.position.x),
          y: Math.floor(this.warehouser.bot.entity.position.y),
          z: Math.floor(this.warehouser.bot.entity.position.z)
        } : null
      },

      // 可用任务
      availableTasks: this._getAvailableTasks(warehouses),

      // 目标进度
      objectives: this._getObjectives(warehouses)
    };

    // 添加每个仓库的详细信息
    for (const [id, wh] of Object.entries(warehouses)) {
      const inventory = wh.getInventory();
      const chestCount = wh.chestPositions ? wh.chestPositions.length : 0;

      state.warehouses[id] = {
        type: wh.type,
        location: wh.location,
        chestCount: chestCount,
        inventory: inventory,
        totalItems: Object.values(inventory).reduce((sum, qty) => sum + qty, 0),
        categories: wh.categories || null
      };
    }

    return state;
  }

  /**
   * 执行动作
   * @param {Object} action - 动作对象
   * @param {string} action.type - 动作类型 ('transfer', 'dispatch', 'wait')
   * @param {Object} action.params - 动作参数
   * @returns {Object} {state, reward, done, info}
   */
  async executeAction(action) {
    this.currentStep++;

    console.log(`\n[Step ${this.currentStep}] 🎬 Executing action: ${action.type}`);
    console.log(`   Parameters:`, JSON.stringify(action.params));

    let reward = 0;
    let success = false;
    let info = {};

    try {
      switch (action.type) {
        case 'transfer':
          success = await this._actionTransfer(action.params);
          reward = success ? 10 : -5;
          info = { success, message: success ? 'Transfer completed' : 'Transfer failed' };
          break;

        case 'dispatch':
          success = await this._actionDispatch(action.params);
          reward = success ? 20 : -5;
          info = { success, message: success ? 'Dispatch completed' : 'Dispatch failed' };
          break;

        case 'wait':
          await this._actionWait();
          success = true;
          reward = -1; // 小惩罚，鼓励快速行动
          info = { success, message: 'Waited for bot to be idle' };
          break;

        default:
          console.warn(`[WarehouseEnv] ⚠️  Unknown action type: ${action.type}`);
          reward = -10;
          info = { success: false, message: 'Unknown action type' };
      }
    } catch (error) {
      console.error(`[WarehouseEnv] ❌ Action execution error:`, error.message);
      reward = -20;
      info = { success: false, error: error.message };
    }

    // 计算效率奖励
    const efficiencyBonus = this._calculateEfficiencyBonus();
    reward += efficiencyBonus;

    // 更新奖励累计
    this.episodeReward += reward;
    this.lastReward = reward;

    // 检查是否完成
    this.isDone = this._checkDone();

    // 记录历史
    this.history.push({
      step: this.currentStep,
      action: action,
      reward: reward,
      cumulativeReward: this.episodeReward,
      state: this.getState()
    });

    // 返回标准的 RL 接口
    return {
      state: this.getState(),
      reward: reward,
      done: this.isDone,
      info: info
    };
  }

  /**
   * 获取奖励（兼容 OpenAI Gym 风格）
   */
  getReward() {
    return this.lastReward;
  }

  /**
   * 检查是否完成
   */
  isEpisodeDone() {
    return this.isDone;
  }

  /**
   * 导出训练数据
   */
  exportHistory() {
    return {
      episode: this.currentEpisode,
      totalSteps: this.currentStep,
      totalReward: this.episodeReward,
      history: this.history,
      timestamp: new Date().toISOString()
    };
  }

  // ============ 私有方法 ============

  /**
   * 动作：从输入仓库转移到分类仓库
   */
  async _actionTransfer(params) {
    const { sourceId, destId, items = ['all'] } = params;
    return await this.scheduler.transferInputToSorting(sourceId, destId, items);
  }

  /**
   * 动作：智能调度到输出仓库
   */
  async _actionDispatch(params) {
    const { outputId, requiredItems } = params;
    return await this.scheduler.smartDispatchToOutput(outputId, requiredItems);
  }

  /**
   * 动作：等待 Bot 空闲
   */
  async _actionWait() {
    await this.warehouser.waitUntilIdle();
  }

  /**
   * 获取可用任务列表
   */
  _getAvailableTasks(warehouses) {
    const tasks = [];

    // 扫描所有仓库，生成可用任务
    for (const [id, wh] of Object.entries(warehouses)) {
      if (wh.type === 'input') {
        const inventory = wh.getInventory();
        const items = Object.keys(inventory).filter(item => inventory[item] > 0);

        if (items.length > 0) {
          tasks.push({
            type: 'transfer',
            source: id,
            priority: 'medium',
            description: `Transfer ${items.length} item types from ${id}`
          });
        }
      }
    }

    return tasks;
  }

  /**
   * 获取目标进度
   */
  _getObjectives(warehouses) {
    const output = warehouses['output_1'];
    if (!output) return {};

    const inventory = output.getInventory();
    return {
      oak_planks: inventory['oak_planks'] || 0,
      cobblestone: inventory['cobblestone'] || 0,
      targets: {
        oak_planks: 192,
        cobblestone: 256
      }
    };
  }

  /**
   * 计算效率奖励
   */
  _calculateEfficiencyBonus() {
    // 根据当前进度给予奖励
    const state = this.getState();
    const objectives = state.objectives;

    if (!objectives.targets) return 0;

    const progress =
      (objectives.oak_planks / objectives.targets.oak_planks) * 0.5 +
      (objectives.cobblestone / objectives.targets.cobblestone) * 0.5;

    return progress * 5; // 最大 +5 奖励
  }

  /**
   * 检查是否完成
   */
  _checkDone() {
    // 检查是否达到最大步数
    if (this.currentStep >= this.maxSteps) {
      console.log(`[WarehouseEnv] ⏰ Max steps reached (${this.maxSteps})`);
      return true;
    }

    // 检查是否完成目标
    const state = this.getState();
    const objectives = state.objectives;

    if (objectives.targets) {
      const oakPlanksDone = objectives.oak_planks >= objectives.targets.oak_planks;
      const cobblestoneDone = objectives.cobblestone >= objectives.targets.cobblestone;

      if (oakPlanksDone && cobblestoneDone) {
        console.log(`[WarehouseEnv] 🎉 Objectives completed!`);
        return true;
      }
    }

    return false;
  }
}

module.exports = { WarehouseEnv };
