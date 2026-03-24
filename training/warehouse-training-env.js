/**
 * 🎮 仓库训练环境 (OpenClaw兼容)
 *
 * 兼容 OpenAI Gym / OpenClaw 的标准接口
 *
 * 训练流程：
 * 1. Agent 观察 state（扁平化观察空间）
 * 2. Agent 输出 action（动作索引或参数）
 * 3. Environment 执行 action，返回 (observation, reward, done, info)
 * 4. Agent 根据 reward 学习
 */

class WarehouseTrainingEnv {
  constructor(warehouseManager, warehouserBot, scheduler) {
    this.warehouseManager = warehouseManager;
    this.warehouser = warehouserBot;
    this.scheduler = scheduler;

    // 环境状态
    this.currentEpisode = 0;
    this.currentStep = 0;
    this.maxSteps = 100;
    this.isDone = false;

    // 奖励统计
    this.totalReward = 0;
    this.episodeHistory = [];

    // ===== OpenClaw兼容：观察空间和动作空间定义 =====

    /**
     * 观察空间定义
     * 返回观察空间的结构描述
     */
    this.observationSpace = {
      type: 'dict',
      shape: {
        // 仓库状态 (每个仓库的特征向量)
        warehouseFeatures: { type: 'array', shape: [15] }, // 3个仓库 * 5个特征

        // 全局特征
        globalFeatures: { type: 'array', shape: [5] },

        // 任务可用性 (每种任务类型是否可用)
        taskAvailability: { type: 'array', shape: [3] }
      },
      totalSize: 23 // 总特征数
    };

    /**
     * 动作空间定义
     * 离散动作空间
     */
    this.actionSpace = {
      type: 'discrete',
      n: 10, // 10种可能的动作
      actions: [
        'NOOP',                    // 0: 无操作
        'TRANSFER_INPUT_SORTING',  // 1: 输入→分类 (木材类)
        'TRANSFER_INPUT_SORTING_STONE', // 2: 输入→分类 (石材类)
        'TRANSFER_INPUT_SORTING_ALL',   // 3: 输入→分类 (全部)
        'DISPATCH_TO_OUTPUT',      // 4: 调度到输出 (按需)
        'BATCH_TRANSFER_2',        // 5: 批次搬运2种物品
        'BATCH_TRANSFER_3',        // 6: 批次搬运3种物品
        'SMART_DISPATCH',          // 7: 智能调度
        'PRIORITY_DISPATCH',       // 8: 优先级调度
        'CLEAR_INPUT'              // 9: 清空输入仓库
      ]
    };

    console.log('[TrainingEnv] 🎮 Warehouse Training Environment initialized (OpenClaw compatible)');
    console.log(`[TrainingEnv] 📊 Observation space: ${this.observationSpace.totalSize} features`);
    console.log(`[TrainingEnv] 🎮 Action space: ${this.actionSpace.n} discrete actions`);
  }

  // ============ OpenClaw标准接口 ============

  /**
   * 重置环境
   * @returns {Object} observation - 初始观察
   */
  reset() {
    this.currentEpisode++;
    this.currentStep = 0;
    this.isDone = false;
    this.totalReward = 0;

    console.log(`\n[TrainingEnv] 🔄 Episode ${this.currentEpisode} started`);

    // 返回结构化观察（OpenClaw格式）
    const observation = this._getStructuredObservation();

    console.log(`[TrainingEnv] 📊 Observation shape: [${observation.vector.length}]`);

    return observation;
  }

  /**
   * 执行动作
   * @param {number|Object} action - 动作索引或动作对象
   * @returns {Object} { observation, reward, done, info }
   */
  async step(action) {
    if (this.isDone) {
      throw new Error('Episode is done. Call reset() to start a new episode.');
    }

    this.currentStep++;

    console.log(`\n[TrainingEnv] 🎬 Step ${this.currentStep}: Action ${action}`);

    // 解析动作
    const task = this._parseAction(action);

    if (!task) {
      // 无效动作，给予负奖励
      const observation = this._getStructuredObservation();
      return {
        observation,
        reward: -10,
        done: false,
        info: { error: 'Invalid action' }
      };
    }

    // 执行任务
    const startTime = Date.now();
    const result = await this._executeTask(task);
    const executionTime = Date.now() - startTime;

    // 计算奖励
    const reward = this._calculateReward(result, executionTime);
    this.totalReward += reward;

    // 获取新观察
    const observation = this._getStructuredObservation();

    // 检查是否结束
    this.isDone = this._checkDone(observation);

    // 额外信息
    const info = {
      episode: this.currentEpisode,
      step: this.currentStep,
      executionTime,
      totalReward: this.totalReward,
      task,
      ...result
    };

    console.log(`[TrainingEnv] 📊 Reward: ${reward.toFixed(2)} (Total: ${this.totalReward.toFixed(2)})`);

    if (this.isDone) {
      console.log(`\n[TrainingEnv] ✅ Episode ${this.currentEpisode} finished`);
      console.log(`[TrainingEnv] 📈 Total reward: ${this.totalReward.toFixed(2)}`);

      this.episodeHistory.push({
        episode: this.currentEpisode,
        totalReward: this.totalReward,
        steps: this.currentStep,
        success: result.success
      });
    }

    return { observation, reward, done: this.isDone, info };
  }

  /**
   * 关闭环境
   */
  close() {
    console.log('\n[TrainingEnv] 📊 Training Summary');
    console.log('='.repeat(80));

    if (this.episodeHistory.length === 0) {
      console.log('No episodes completed');
      return;
    }

    const totalRewards = this.episodeHistory.map(h => h.totalReward);
    const successRate = this.episodeHistory.filter(h => h.success).length / this.episodeHistory.length;
    const avgSteps = this.episodeHistory.reduce((sum, h) => sum + h.steps, 0) / this.episodeHistory.length;

    console.log(`Total episodes: ${this.episodeHistory.length}`);
    console.log(`Success rate: ${(successRate * 100).toFixed(2)}%`);
    console.log(`Average reward: ${(totalRewards.reduce((a, b) => a + b, 0) / totalRewards.length).toFixed(2)}`);
    console.log(`Best episode: ${Math.max(...totalRewards).toFixed(2)}`);
    console.log(`Average steps: ${avgSteps.toFixed(2)}`);
    console.log('='.repeat(80) + '\n');
  }

  // ============ 观察空间处理 ============

  /**
   * 获取结构化观察（OpenClaw格式）
   * @returns {Object} { vector, dict } - 向量形式和字典形式
   */
  _getStructuredObservation() {
    const warehouses = this.warehouseManager.getAllWarehouses();
    const warehouseList = Object.entries(warehouses);

    // 1. 仓库特征向量 (每个仓库5个特征)
    const warehouseFeatures = [];
    const warehouseTypes = { 'input': 0, 'sorting': 1, 'output': 2 };

    for (const [id, wh] of warehouseList) {
      const inventory = wh.getInventory();
      const itemCount = Object.values(inventory).reduce((sum, qty) => sum + qty, 0);
      const capacity = wh.getTotalCapacity();
      const utilization = itemCount / capacity;

      warehouseFeatures.push(
        warehouseTypes[wh.type] / 2,  // 归一化的仓库类型
        utilization,                  // 利用率 0-1
        itemCount / 1000,             // 归一化的物品数量
        wh.location.x / 200,          // 归一化的X坐标
        wh.location.z / 200           // 归一化的Z坐标
      );
    }

    // 填充到固定长度 (最多3个仓库)
    while (warehouseFeatures.length < 15) {
      warehouseFeatures.push(0);
    }

    // 2. 全局特征
    let totalItems = 0;
    let inputItems = 0;
    let sortingItems = 0;
    let outputItems = 0;

    for (const [id, wh] of warehouseList) {
      const inventory = wh.getInventory();
      const count = Object.values(inventory).reduce((sum, qty) => sum + qty, 0);
      totalItems += count;

      if (wh.type === 'input') inputItems += count;
      else if (wh.type === 'sorting') sortingItems += count;
      else if (wh.type === 'output') outputItems += count;
    }

    const outputWarehouse = warehouses['output_1'];
    let outputProgress = 0;
    if (outputWarehouse) {
      const inventory = outputWarehouse.getInventory();
      const oakPlanks = inventory['oak_planks'] || 0;
      const cobblestone = inventory['cobblestone'] || 0;
      outputProgress = (oakPlanks / 192 + cobblestone / 256) / 2;
    }

    const globalFeatures = [
      totalItems / 1000,           // 总物品数
      inputItems / 1000,           // 输入仓库物品数
      sortingItems / 1000,         // 分类仓库物品数
      outputItems / 1000,          // 输出仓库物品数
      outputProgress               // 输出目标完成度 0-1
    ];

    // 3. 任务可用性
    const inputWarehouse = warehouses['input_1'];
    const sortingWarehouse = warehouses['sorting_1'];

    let hasInputItems = false;
    if (inputWarehouse) {
      const inventory = inputWarehouse.getInventory();
      hasInputItems = Object.values(inventory).some(qty => qty > 0);
    }

    let hasSortingItems = false;
    if (sortingWarehouse) {
      const inventory = sortingWarehouse.getInventory();
      hasSortingItems = Object.values(inventory).some(qty => qty > 0);
    }

    const needsOutput = outputProgress < 1;

    const taskAvailability = [
      hasInputItems ? 1 : 0,    // 是否可执行输入→分类
      hasSortingItems ? 1 : 0,  // 是否可执行分类→输出
      needsOutput ? 1 : 0       // 是否需要补充输出
    ];

    // 合并为向量（OpenClaw常用格式）
    const vector = [
      ...warehouseFeatures,
      ...globalFeatures,
      ...taskAvailability
    ];

    return {
      vector,                    // 扁平化向量 [23]
      dict: {
        warehouseFeatures,
        globalFeatures,
        taskAvailability
      },
      episode: this.currentEpisode,
      step: this.currentStep
    };
  }

  // ============ 动作空间处理 ============

  /**
   * 解析动作为任务
   * @param {number} actionIndex - 动作索引
   * @returns {Object|null} task
   */
  _parseAction(actionIndex) {
    const actionName = this.actionSpace.actions[actionIndex];

    console.log(`[TrainingEnv] 🎯 Action: ${actionName}`);

    const warehouses = this.warehouseManager.getAllWarehouses();
    const inputWh = warehouses['input_1'];
    const sortingWh = warehouses['sorting_1'];
    const outputWh = warehouses['output_1'];

    switch (actionIndex) {
      case 0: // NOOP
        return null;

      case 1: // TRANSFER_INPUT_SORTING (木材类)
        if (!inputWh || !sortingWh) return null;
        return {
          type: 'transfer',
          source: 'input_1',
          destination: 'sorting_1',
          items: ['oak_log', 'birch_log', 'oak_planks', 'birch_planks']
        };

      case 2: // TRANSFER_INPUT_SORTING_STONE (石材类)
        if (!inputWh || !sortingWh) return null;
        return {
          type: 'transfer',
          source: 'input_1',
          destination: 'sorting_1',
          items: ['cobblestone', 'stone', 'andesite', 'diorite', 'granite']
        };

      case 3: // TRANSFER_INPUT_SORTING_ALL (全部)
        if (!inputWh || !sortingWh) return null;
        return {
          type: 'transfer',
          source: 'input_1',
          destination: 'sorting_1',
          items: ['all']
        };

      case 4: // DISPATCH_TO_OUTPUT
        if (!outputWh) return null;
        return {
          type: 'dispatch',
          destination: 'output_1',
          requiredItems: [
            { item: 'oak_planks', quantity: 192 },
            { item: 'cobblestone', quantity: 256 }
          ]
        };

      case 5: // BATCH_TRANSFER_2
        if (!inputWh || !sortingWh) return null;
        return {
          type: 'transfer',
          source: 'input_1',
          destination: 'sorting_1',
          items: this._getTopItems(inputWh, 2)
        };

      case 6: // BATCH_TRANSFER_3
        if (!inputWh || !sortingWh) return null;
        return {
          type: 'transfer',
          source: 'input_1',
          destination: 'sorting_1',
          items: this._getTopItems(inputWh, 3)
        };

      case 7: // SMART_DISPATCH
        if (!outputWh) return null;
        return {
          type: 'dispatch',
          destination: 'output_1',
          requiredItems: [
            { item: 'oak_planks', quantity: 192 },
            { item: 'cobblestone', quantity: 256 }
          ]
        };

      case 8: // PRIORITY_DISPATCH
        if (!outputWh) return null;
        return {
          type: 'dispatch',
          destination: 'output_1',
          requiredItems: [
            { item: 'oak_planks', quantity: 192 },
            { item: 'cobblestone', quantity: 256 }
          ]
        };

      case 9: // CLEAR_INPUT
        if (!inputWh || !sortingWh) return null;
        return {
          type: 'transfer',
          source: 'input_1',
          destination: 'sorting_1',
          items: ['all']
        };

      default:
        return null;
    }
  }

  /**
   * 获取数量最多的N种物品
   */
  _getTopItems(warehouse, n) {
    const inventory = warehouse.getInventory();
    const items = Object.entries(inventory)
      .filter(([item, qty]) => qty > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([item, qty]) => item);

    return items.length > 0 ? items : ['oak_log'];
  }

  // ============ 执行和奖励 ============

  /**
   * 执行单个任务
   */
  async _executeTask(task) {
    try {
      let result;

      if (task.type === 'transfer') {
        result = await this.scheduler.transferInputToSorting(
          task.source,
          task.destination,
          task.items
        );
      } else if (task.type === 'dispatch') {
        const requiredItems = {};
        for (const item of task.requiredItems) {
          requiredItems[item.item] = item.quantity;
        }
        result = await this.scheduler.smartDispatchToOutput(task.destination, requiredItems);
      }

      return {
        success: result || false,
        totalTasks: 1,
        successCount: result ? 1 : 0,
        failCount: result ? 0 : 1
      };

    } catch (error) {
      console.error(`[TrainingEnv] ❌ Task execution error:`, error.message);
      return {
        success: false,
        error: error.message,
        totalTasks: 1,
        successCount: 0,
        failCount: 1
      };
    }
  }

  /**
   * 计算奖励
   */
  _calculateReward(result, executionTime) {
    let reward = 0;

    // 1. 成功执行的正奖励
    reward += result.successCount * 10;

    // 2. 失败的负奖励
    reward -= result.failCount * 5;

    // 3. 效率奖励
    reward += Math.max(0, (10000 - executionTime) / 1000);

    // 4. 目标完成奖励
    const outputWarehouse = this.warehouseManager.getWarehouse('output_1');
    if (outputWarehouse) {
      const inventory = outputWarehouse.getInventory();
      const oakPlanks = inventory['oak_planks'] || 0;
      const cobblestone = inventory['cobblestone'] || 0;

      if (oakPlanks >= 192) reward += 50;
      if (cobblestone >= 256) reward += 50;
    }

    return reward;
  }

  /**
   * 检查是否结束
   */
  _checkDone(observation) {
    // 达到最大步数
    if (this.currentStep >= this.maxSteps) {
      return true;
    }

    // 输出目标完成
    if (observation.dict.globalFeatures[4] >= 1) {
      console.log('[TrainingEnv] 🎯 Target reached!');
      return true;
    }

    return false;
  }

  // ============ 辅助方法 ============

  /**
   * 渲染环境（可选）
   */
  render() {
    const observation = this._getStructuredObservation();

    console.log('\n' + '='.repeat(80));
    console.log(`🎮 Episode ${this.currentEpisode} - Step ${this.currentStep}`);
    console.log('='.repeat(80));

    console.log(`\n📊 Observation vector (first 10): [${observation.vector.slice(0, 10).map(v => v.toFixed(3)).join(', ')}...]`);
    console.log(`📦 Global features: [${observation.dict.globalFeatures.map(v => v.toFixed(3)).join(', ')}]`);
    console.log(`✅ Task availability: [${observation.dict.taskAvailability.join(', ')}]`);
    console.log(`⏱️  Total reward: ${this.totalReward.toFixed(2)}`);
    console.log('='.repeat(80) + '\n');
  }

  /**
   * 获取空间信息（OpenClaw使用）
   */
  getSpaces() {
    return {
      observation: this.observationSpace,
      action: this.actionSpace
    };
  }

  /**
   * 获取种子（用于可重复性）
   */
  seed(seed) {
    this.seedValue = seed;
    console.log(`[TrainingEnv] 🎲 Seed set to: ${seed}`);
  }
}

module.exports = { WarehouseTrainingEnv };
